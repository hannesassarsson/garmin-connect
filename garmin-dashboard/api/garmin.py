from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import date, datetime, timedelta

def safe(fn, default=None):
    try:
        return fn()
    except Exception as e:
        return default if default is not None else {"_error": str(e)}


class handler(BaseHTTPRequestHandler):
    def _send(self, status: int, data: dict):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(json.dumps(data, default=str).encode("utf-8"))

    def do_OPTIONS(self):
        self._send(200, {"ok": True})

    def do_GET(self):
        self._send(200, {"message": "Garmin API ready", "status": "ok"})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length).decode("utf-8") if length else "{}"
            payload = json.loads(body or "{}")
        except Exception as e:
            return self._send(400, {"error": f"Invalid JSON: {e}"})

        action = payload.get("action", "data")

        try:
            from garminconnect import Garmin
        except ImportError:
            return self._send(500, {"error": "garminconnect not installed"})

        email = (payload.get("email") or os.environ.get("GARMIN_EMAIL") or "").strip()
        password = (payload.get("password") or os.environ.get("GARMIN_PASSWORD") or "").strip()

        if action == "login":
            if not email or not password:
                return self._send(400, {"error": "email and password required"})
            try:
                client = Garmin(email, password)
                client.login()
                return self._send(200, {
                    "ok": True,
                    "message": "Inloggad",
                    "display_name": getattr(client, "display_name", None) or email.split("@")[0],
                })
            except Exception as e:
                return self._send(401, {"error": f"Login misslyckades: {str(e)}"})

        if not email or not password:
            return self._send(401, {"error": "Ingen inloggning. Logga in först."})

        try:
            client = Garmin(email, password)
            client.login()
            today = date.today()
            today_str = today.isoformat()

            stats = safe(lambda: client.get_stats(today_str), {})
            if not stats or (isinstance(stats, dict) and stats.get("_error")):
                stats = safe(lambda: client.get_user_summary(today_str), {}) or {}

            body_battery_raw = safe(lambda: client.get_body_battery(today_str))
            body_battery_value = 50
            if isinstance(body_battery_raw, list) and body_battery_raw:
                last = body_battery_raw[-1]
                if isinstance(last, dict):
                    body_battery_value = int(last.get("bodyBatteryValue") or last.get("charged") or last.get("bodyBatteryLevelValue") or 50)
            elif isinstance(body_battery_raw, dict) and not body_battery_raw.get("_error"):
                body_battery_value = int(body_battery_raw.get("bodyBatteryValue") or body_battery_raw.get("charged") or 50)

            hrv_raw = safe(lambda: client.get_hrv_data(today_str))
            hrv, hrv_status = 0, "unknown"
            if isinstance(hrv_raw, dict) and not hrv_raw.get("_error"):
                summary = hrv_raw.get("hrvSummary") or hrv_raw
                hrv = int(summary.get("lastNightAvg") or summary.get("weeklyAvg") or 0)
                hrv_status = summary.get("status") or ("balanced" if hrv > 40 else "low")

            sleep_raw = safe(lambda: client.get_sleep_data(today_str))
            sleep = {"score": 0, "totalHours": 0, "deepMinutes": 0, "lightMinutes": 0, "remMinutes": 0, "awakeMinutes": 0, "quality": "fair"}
            if isinstance(sleep_raw, dict) and not sleep_raw.get("_error"):
                daily = sleep_raw.get("dailySleepDTO") or sleep_raw
                scores = daily.get("sleepScores") or {}
                overall_s = scores.get("overall") or {}
                score = overall_s.get("value") or daily.get("sleepScore") or daily.get("overallScore") or 0
                sleep = {
                    "score": int(score or 0),
                    "totalHours": round((daily.get("sleepTimeSeconds") or 0) / 3600, 1),
                    "deepMinutes": round((daily.get("deepSleepSeconds") or 0) / 60),
                    "lightMinutes": round((daily.get("lightSleepSeconds") or 0) / 60),
                    "remMinutes": round((daily.get("remSleepSeconds") or 0) / 60),
                    "awakeMinutes": round((daily.get("awakeSleepSeconds") or 0) / 60),
                    "quality": self._sleep_quality(score),
                    "avgRespiration": daily.get("averageRespirationValue"),
                    "avgSpO2": daily.get("averageSpO2Value"),
                    "restlessMoments": daily.get("restlessMomentsCount"),
                }

            stress_raw = safe(lambda: client.get_stress_data(today_str))
            stress = 0
            if isinstance(stress_raw, dict) and not stress_raw.get("_error"):
                stress = int(stress_raw.get("avgStressLevel") or stress_raw.get("overallStressLevel") or 0)

            hr_raw = safe(lambda: client.get_heart_rates(today_str))
            resting_hr = (stats.get("restingHeartRate") if isinstance(stats, dict) else None) or 0
            max_hr = min_hr = 0
            if isinstance(hr_raw, dict) and not hr_raw.get("_error"):
                resting_hr = resting_hr or hr_raw.get("restingHeartRate") or 0
                max_hr = hr_raw.get("maxHeartRate") or 0
                min_hr = hr_raw.get("minHeartRate") or 0

            s = stats if isinstance(stats, dict) else {}
            steps = s.get("totalSteps") or 0
            step_goal = s.get("dailyStepGoal") or 10000
            floors = s.get("floorsAscended") or 0
            intensity = s.get("intensityMinutes") or 0
            vigorous = s.get("vigorousIntensityMinutes") or 0
            calories = s.get("totalKilocalories") or 0
            active_calories = s.get("activeKilocalories") or 0
            distance = s.get("totalDistanceMeters") or 0

            respiration = safe(lambda: client.get_respiration_data(today_str))
            spo2 = safe(lambda: client.get_spo2_data(today_str))
            avg_resp = avg_spo2 = None
            if isinstance(respiration, dict) and not respiration.get("_error"):
                avg_resp = respiration.get("avgWakingRespirationValue") or respiration.get("avgSleepRespirationValue")
            if isinstance(spo2, dict) and not spo2.get("_error"):
                avg_spo2 = spo2.get("averageSpO2") or spo2.get("avgSpO2")

            training_readiness = safe(lambda: client.get_training_readiness(today_str))
            readiness_score = None
            if isinstance(training_readiness, dict) and not training_readiness.get("_error"):
                readiness_score = training_readiness.get("score") or training_readiness.get("trainingReadinessScore")

            activities = []
            acts = safe(lambda: client.get_activities(0, 20), [])
            if isinstance(acts, list):
                for a in acts:
                    if not isinstance(a, dict):
                        continue
                    atype = a.get("activityType")
                    type_key = atype.get("typeKey") if isinstance(atype, dict) else (atype or "unknown")
                    activities.append({
                        "id": str(a.get("activityId") or ""),
                        "type": type_key,
                        "name": a.get("activityName") or "Aktivitet",
                        "date": (a.get("startTimeLocal") or a.get("startTimeGMT") or "")[:10],
                        "durationMinutes": round((a.get("duration") or a.get("elapsedDuration") or 0) / 60),
                        "distanceKm": round((a.get("distance") or 0) / 1000, 2) if a.get("distance") else None,
                        "avgHR": a.get("averageHR") or a.get("avgHR"),
                        "maxHR": a.get("maxHR"),
                        "calories": a.get("calories"),
                        "trainingEffect": a.get("aerobicTrainingEffect") or a.get("trainingEffect"),
                        "anaerobicEffect": a.get("anaerobicTrainingEffect"),
                        "elevationGain": a.get("elevationGain"),
                    })

            devices = safe(lambda: client.get_devices(), [])
            device_names = []
            if isinstance(devices, list):
                for d in devices:
                    if isinstance(d, dict):
                        device_names.append(d.get("productDisplayName") or d.get("deviceName") or d.get("productName") or "Device")

            weight = safe(lambda: client.get_body_composition(today_str))
            weight_kg = None
            if isinstance(weight, dict) and not weight.get("_error"):
                weight_kg = weight.get("weight") or weight.get("bodyWeight")
                if weight_kg and weight_kg > 200:
                    weight_kg = round(weight_kg / 1000, 1)

            hydration = safe(lambda: client.get_hydration_data(today_str))
            hydration_ml = None
            if isinstance(hydration, dict) and not hydration.get("_error"):
                hydration_ml = hydration.get("valueInML") or hydration.get("goalInML")

            overall = "good"
            if body_battery_value >= 75: overall = "great"
            elif body_battery_value < 35: overall = "needs_rest"
            elif body_battery_value < 50: overall = "tired"

            result = {
                "ok": True,
                "status": {"overall": overall, "message": self._make_message(overall, body_battery_value, sleep.get("score")), "date": today_str},
                "recovery": {
                    "bodyBattery": body_battery_value, "bodyBatteryTrend": "stable",
                    "hrv": hrv, "hrvStatus": hrv_status, "stress": stress,
                    "restingHR": int(resting_hr or 0), "maxHR": int(max_hr or 0), "minHR": int(min_hr or 0),
                    "trainingReadiness": readiness_score,
                },
                "sleep": sleep,
                "daily": {
                    "steps": int(steps or 0), "stepGoal": int(step_goal or 10000), "floors": int(floors or 0),
                    "intensityMinutes": int(intensity or 0), "vigorousMinutes": int(vigorous or 0),
                    "calories": int(calories or 0), "activeCalories": int(active_calories or 0),
                    "distanceKm": round((distance or 0) / 1000, 2),
                    "avgRespiration": avg_resp, "avgSpO2": avg_spo2,
                    "weightKg": weight_kg, "hydrationMl": hydration_ml,
                },
                "devices": device_names,
                "recommendations": self._make_recommendations(overall, body_battery_value, sleep, hrv),
                "recentActivities": activities,
                "lastSync": datetime.utcnow().isoformat() + "Z",
                "meta": {
                    "statsKeys": list(stats.keys())[:30] if isinstance(stats, dict) else [],
                    "hasBodyBattery": body_battery_raw is not None and not (isinstance(body_battery_raw, dict) and body_battery_raw.get("_error")),
                    "hasSleep": bool(sleep.get("score")), "hasHRV": hrv > 0, "activityCount": len(activities),
                },
            }
            return self._send(200, result)
        except Exception as e:
            return self._send(500, {"error": f"Kunde inte hämta data: {str(e)}"})

    def _make_message(self, overall, bb, sleep_score):
        if overall == "great": return "Du är väl återhämtad. Bra läge för ett hårdare pass idag."
        if overall == "good": return "Hyfsat återhämtad. Ett medelhårt pass funkar bra."
        if overall == "tired": return "Body Battery är lägre. Överväg ett lättare pass eller aktiv återhämtning."
        return "Du behöver mer vila. Prioritera sömn och återhämtning idag."

    def _sleep_quality(self, score):
        if not score: return "fair"
        s = int(score)
        if s >= 85: return "excellent"
        if s >= 70: return "good"
        if s >= 55: return "fair"
        return "poor"

    def _make_recommendations(self, overall, bb, sleep, hrv):
        recs = []
        if overall in ("tired", "needs_rest"):
            recs.append({"id": "1", "type": "recovery", "priority": "high", "title": "Prioritera återhämtning", "text": f"Body Battery ligger på {bb}. Ta det lugnt idag.", "icon": "battery"})
        else:
            recs.append({"id": "1", "type": "training", "priority": "medium", "title": "Bra läge att träna", "text": f"Body Battery {bb} – du klarar ett kvalitativt pass.", "icon": "activity"})
        score = sleep.get("score") or 0
        if score and score < 70:
            recs.append({"id": "2", "type": "sleep", "priority": "medium", "title": "Sömnen kan bli bättre", "text": f"Sömnpoäng {score}. Sikta på 7,5–8 h.", "icon": "moon"})
        else:
            recs.append({"id": "2", "type": "sleep", "priority": "low", "title": "Sömnen ser okej ut", "text": "Fortsätt med samma rutiner.", "icon": "moon"})
        recs.append({"id": "3", "type": "general", "priority": "low", "title": "Tips", "text": "Synka klockan regelbundet så datan alltid är färsk.", "icon": "activity"})
        return recs
