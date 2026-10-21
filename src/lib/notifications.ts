// Recordatorios locales (expo-notifications). Los textos llegan ya traducidos
// para mantener la internacionalización fuera de este módulo.
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let channelReady = false;
async function ensureChannel(name: string): Promise<void> {
  if (Platform.OS !== 'android' || channelReady) return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  channelReady = true;
}

/** Pide permiso si aún no se concedió. Devuelve true si se pueden mostrar notificaciones. */
export async function requestPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (current.canAskAgain === false) return false;
    const res = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return res.granted;
  } catch {
    return false;
  }
}

async function hasPermission(): Promise<boolean> {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

export interface ReminderTexts {
  channelName: string;
  workoutTitle: string;
  workoutBody: string;
  mealBody: string;
  /** Título por comida: breakfast, snack_am, lunch, snack_pm, dinner */
  mealTitles: Record<string, string>;
}

export interface ReminderOptions {
  workoutReminders: boolean;
  workoutTime: string; // 'HH:MM'
  mealReminders: boolean;
  daysPerWeek: number;
  mealsPerDay: number;
  texts: ReminderTexts;
}

// Días de la semana en formato de expo-notifications: 1 = domingo … 7 = sábado.
const MON = 2;
const TUE = 3;
const WED = 4;
const THU = 5;
const FRI = 6;
const SAT = 7;

/** Días de entrenamiento según la frecuencia semanal. */
export function trainingWeekdays(daysPerWeek: number): number[] {
  if (daysPerWeek <= 1) return [MON];
  if (daysPerWeek === 2) return [MON, THU];
  if (daysPerWeek === 3) return [MON, WED, FRI];
  if (daysPerWeek === 4) return [MON, TUE, THU, FRI];
  if (daysPerWeek === 5) return [MON, TUE, WED, FRI, SAT];
  return [MON, TUE, WED, THU, FRI, SAT];
}

/** Horarios de comida (coinciden con mealSlots() del motor). */
export function mealTimes(mealsPerDay: number): { slotId: string; hour: number; minute: number }[] {
  const n = Math.max(3, Math.min(5, Math.round(mealsPerDay)));
  const out = [{ slotId: 'breakfast', hour: 8, minute: 0 }];
  if (n === 5) out.push({ slotId: 'snack_am', hour: 10, minute: 30 });
  out.push({ slotId: 'lunch', hour: 13, minute: 0 });
  if (n >= 4) out.push({ slotId: 'snack_pm', hour: 16, minute: 30 });
  out.push({ slotId: 'dinner', hour: 19, minute: 0 });
  return out;
}

function parseTime(hhmm: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return { hour: 18, minute: 0 };
  const hour = Math.min(23, Math.max(0, Number(m[1])));
  const minute = Math.min(59, Math.max(0, Number(m[2])));
  return { hour, minute };
}

/** Cancela todos los recordatorios y vuelve a programar los activos. */
export async function rescheduleReminders(o: ReminderOptions): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!o.workoutReminders && !o.mealReminders) return;
    if (!(await hasPermission())) return;
    await ensureChannel(o.texts.channelName);
    const channel = Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {};

    if (o.workoutReminders) {
      const { hour, minute } = parseTime(o.workoutTime);
      for (const weekday of trainingWeekdays(o.daysPerWeek)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: o.texts.workoutTitle, body: o.texts.workoutBody, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday, hour, minute, ...channel },
        });
      }
    }
    if (o.mealReminders) {
      for (const m of mealTimes(o.mealsPerDay)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: o.texts.mealTitles[m.slotId] ?? m.slotId, body: o.texts.mealBody, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: m.hour, minute: m.minute, ...channel },
        });
      }
    }
  } catch {
    // los recordatorios nunca deben romper la app
  }
}

export async function cancelAllReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // nada
  }
}
