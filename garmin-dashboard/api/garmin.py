from http.server import BaseHTTPRequestHandler
import json
import os
from datetime import date, datetime, timedelta

# Vercel Python handler
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
            return self._send(500, {
                "error": "garminconnect not installed. Add 'garminconnect' to requirements.txt"
            })

        if action == "login":
            email = payload.get("email", "").strip()
            password = payload.get("password", "").strip()
            if not email or not password:
                return self._send(400, {"error": "email and password required"})

            try:
                client = Garmin(email, password)
                client.login()
                tokens = {
                    "display_name": getattr(client, "display_name", None),
                    "full_name": getattr(client, "full_name", None),
                }
                return self._send(200, {
                    "ok": True,
                    "message": "Inloggad",
                    "tokens": tokens,
                    "display_name": tokens.get("display_name") or email.split("@")[0],
                })
            except Exception as e:
                return self._send(401, {"error": f"Login misslyckades: {str(e)}"})

        email = payload.get("email")
        password = payload.get("password")

        if not email or not password:
            email = os.environ.get("GARMIN_EMAIL")
            password = os.environ.get("GARMIN_PASSWORD")

        if not email or not password:
            return self._send(401, {
                "error": "Ingen inloggning. Logga in först eller sätt GARMIN_EMAIL + GARMIN_PASSWORD i Vercel env."
            })

        try:
            client = Garmin(email, password)
            client.login()

            today = date.today()
            today_str = today.isoformat()

            stats = {}
            try:
                stats = client.get_stats(today_str) or {}
            except Exception:
                try:
                    stats = client.get_user_summary(today_str) or {}
                except Exception as e:
                    stats = {"_error": str(e)}

            body_battery = None
            try:
                bb = client.get_body_battery(today_str)
                if bb and isinstance(bb, list) and len(bb) > 0:
                    body_battery = bb[-1].get("charged") or bb[-1].get("bodyBatteryValue") or bb[-1]
                elif isinstance(bb, dict):
                    body_battery = bb
            except Exception:
                pass

            hrv = None
            try:
                hrv_data = client.get_hrv_data(today_str)
                if hrv_data:
                    hrv = hrv_data.get("hrvSummary", {}).get("lastNightAvg") or hrv_data.get("lastNightAvg")
            except Exception:
                pass

            sleep = {}
            try:
                sleep_raw = client.get_sleep_data(today_str)
                if sleep_raw:
                    daily = sleep_raw.get("dailySleepDTO") or sleep_raw
                    sleep = {
                        "score": daily.get("sleepScores", {}).get("overall", {}).get("value")
                                 or daily.get("sleepScore")
                                 or daily.get("overallScore"),
                        "totalHours": round((daily.get("sleepTimeSeconds") or 0) / 3600, 1),
                        "deepMinutes": round((daily.get("deepSleepSeconds") or 0) / 60),
                        "lightMinutes": round((daily.get("lightSleepSeconds") or 0) / 60),
                        "remMinutes": round((daily.get("remSleepSeconds") or 0) / 60),
                        "awakeMinutes": round((daily.get("awakeSleepSeconds") or 0) / 60),
                    }
            except Exception as e:
                sleep = {"_error": str(e)}

            stress = None
            try:
                stress_data = client.get_stress_data(today_str)
                if stress_data:
                    stress = stress_data.get("avgStressLevel") or stress_data.get("overallStressLevel")
            except Exception:
                pass

            resting_hr = stats.get("restingHeartRate") or stats.get("restingHR")

            activities = []
            try:
                acts = client.get_activities(0, 5)
                for a in acts or []:
                    activities.append({
                        "id": str(a.get("activityId") or a.get("activityId")),
                        "type": (a.get("activityType") or {}).get("typeKey") or a.get("activityType") or "unknown",
                        "name": a.get("activityName") or "Aktivitet",
                        "date": (a.get("startTimeLocal") or a.get("startTimeGMT") or "")[:10],
                        "durationMinutes": round((a.get("duration") or a.get("elapsedDuration") or 0) / 60),
                        "distanceKm": round((a.get("distance") or 0) / 1000, 2) if a.get("distance") else None,
                        "avgHR": a.get("averageHR") or a.get("avgHR"),
                        "calories": a.get("calories"),
                        "trainingEffect": a.get("aerobicTrainingEffect") or a.get("trainingEffect"),
                    })
            except Exception as e:
                activities = [{"_error": str(e)}]

            body_battery_value = 50
            if isinstance(body_battery, (int, float)):
                body_battery_value = int(body_battery)
            elif isinstance(body_battery, dict):
                body_battery_value = int(body_battery.get("bodyBatteryValue") or body_battery.get("charged") or 50)

            overall = "good"
            if body_battery_value >= 75:
                overall = "great"
            elif body_battery_value < 35:
                overall = "needs_rest"
            elif body_battery_value < 50:
                overall = "tired"

            result = {
                "ok": True,
                "status": {
                    "overall": overall,
                    "message": self._make_message(overall, body_battery_value, sleep.get("score")),
                    "date": today_str,
                },
                "recovery": {
                    "bodyBattery": body_battery_value,
                    "bodyBatteryTrend": "stable",
                    "hrv": int(hrv) if hrv else 0,
                    "hrvStatus": "balanced" if (hrv or 0) > 40 else "low",
                    "stress": int(stress) if stress else 0,
                    "restingHR": int(resting_hr) if resting_hr else 0,
                },
                "sleep": {
                    "score": int(sleep.get("score") or 0),
                    "totalHours": float(sleep.get("totalHours") or 0),
                    "deepMinutes": int(sleep.get("deepMinutes") or 0),
                    "lightMinutes": int(sleep.get("lightMinutes") or 0),
                    "remMinutes": int(sleep.get("remMinutes") or 0),
                    "awakeMinutes": int(sleep.get("awakeMinutes") or 0),
                    "quality": self._sleep_quality(sleep.get("score")),
                },
                "recommendations": self._make_recommendations(overall, body_battery_value, sleep, hrv),
                "recentActivities": activities,
                "lastSync": datetime.utcnow().isoformat() + "Z",
            }
            return self._send(200, result)

        except Exception as e:
            return self._send(500, {"error": f"Kunde inte hämta data: {str(e)}"})

    def do_GET(self):
        self._send(200, {
            "message": "Garmin API. Använd POST med action=login eller action=data",
            "status": "ready"
        })

    def _make_message(self, overall, bb, sleep_score):
        if overall == "great":
            return "Du är väl återhämtad. Bra läge för ett hårdare pass idag."
        if overall == "good":
            return "Hyfsat återhämtad. Ett medelhårt pass funkar bra."
        if overall == "tired":
            return "Body Battery är lägre. Överväg ett lättare pass eller aktiv återhämtning."
        return "Du behöver mer vila. Prioritera sömn och återhämtning idag."

    def _sleep_quality(self, score):
        if not score:
            return "fair"
        s = int(score)
        if s >= 85:
            return "excellent"
        if s >= 70:
            return "good"
        if s >= 55:
            return "fair"
        return "poor"

    def _make_recommendations(self, overall, bb, sleep, hrv):
        recs = []
        if overall in ("tired", "needs_rest"):
            recs.append({
                "id": "1",
                "type": "recovery",
                "priority": "high",
                "title": "Prioritera återhämtning",
                "text": f"Body Battery ligger på {bb}. Ta det lugnt idag och sikta på bra sömn ikväll.",
                "icon": "battery",
            })
        else:
            recs.append({
                "id": "1",
                "type": "training",
                "priority": "medium",
                "title": "Bra läge att träna",
                "text": f"Body Battery {bb} – du klarar ett kvalitativt pass. Undvik maxinsats om sömnen var kort.",
                "icon": "activity",
            })

        score = sleep.get("score") or 0
        if score and score < 70:
            recs.append({
                "id": "2",
                "type": "sleep",
                "priority": "medium",
                "title": "Sömnen kan bli bättre",
                "text": f"Sömnpoäng {score}. Sikta på 7,5–8 h och håll en fast läggdags.",
                "icon": "moon",
            })
        else:
            recs.append({
                "id": "2",
                "type": "sleep",
                "priority": "low",
                "title": "Sömnen ser okej ut",
                "text": "Fortsätt med samma rutiner för att hålla återhämtningen stabil.",
                "icon": "moon",
            })

        recs.append({
            "id": "3",
            "type": "general",
            "priority": "low",
            "title": "Tips",
            "text": "Synka klockan regelbundet så datan alltid är färsk när du öppnar appen.",
            "icon": "activity",
        })
        return recs
