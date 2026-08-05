export interface SleepData {
  score: number;
  totalHours: number;
  deepMinutes: number;
  lightMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor';
}

export interface RecoveryData {
  bodyBattery: number;
  bodyBatteryTrend: 'up' | 'down' | 'stable';
  hrv: number;
  hrvStatus: 'balanced' | 'unbalanced' | 'low';
  stress: number;
  restingHR: number;
}

export interface ActivitySummary {
  id: string;
  type: string;
  name: string;
  date: string;
  durationMinutes: number;
  distanceKm?: number;
  avgHR?: number;
  calories: number;
  trainingEffect?: number;
}

export interface DailyStatus {
  overall: 'great' | 'good' | 'tired' | 'needs_rest';
  message: string;
  date: string;
}

export interface AIRecommendation {
  id: string;
  type: 'recovery' | 'training' | 'sleep' | 'general';
  priority: 'high' | 'medium' | 'low';
  title: string;
  text: string;
  icon: string;
}

export interface DashboardData {
  status: DailyStatus;
  recovery: RecoveryData;
  sleep: SleepData;
  recommendations: AIRecommendation[];
  recentActivities: ActivitySummary[];
  lastSync: string;
}
