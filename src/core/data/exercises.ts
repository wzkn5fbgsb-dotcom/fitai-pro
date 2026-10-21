// Biblioteca de ejercicios. Los textos de técnica son orientativos.
// Los videos sólo se añadirán cuando procedan de fuentes identificables y
// verificadas (campo `videoUrl`); hoy ningún ejercicio tiene video asignado.
import type { BodyArea, Equipment } from '../types.ts';

export type Pattern =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'h_push'
  | 'v_push'
  | 'h_pull'
  | 'v_pull'
  | 'knee_flex'
  | 'knee_ext'
  | 'glute'
  | 'calf'
  | 'lat_delt'
  | 'rear_delt'
  | 'biceps'
  | 'triceps'
  | 'core';

export type Muscle =
  | 'quads'
  | 'glutes'
  | 'hamstrings'
  | 'calves'
  | 'chest'
  | 'upper_back'
  | 'lats'
  | 'front_delts'
  | 'side_delts'
  | 'rear_delts'
  | 'biceps'
  | 'triceps'
  | 'core'
  | 'lower_back';

export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'band' | 'kettlebell';

export interface Exercise {
  id: string;
  name: { es: string; en: string };
  pattern: Pattern;
  primary: Muscle;
  secondary: Muscle[];
  equipment: Equipment[]; // todos requeridos
  load: LoadType;
  difficulty: 1 | 2 | 3;
  compound: boolean;
  stress: BodyArea[]; // zonas que el ejercicio exige de forma importante
  cues: { es: string[]; en: string[] };
  mistakes: { es: string[]; en: string[] };
  videoUrl?: string;
}

type Bi = { es: string[]; en: string[] };
const ex = (
  id: string,
  es: string,
  en: string,
  pattern: Pattern,
  primary: Muscle,
  secondary: Muscle[],
  equipment: Equipment[],
  load: LoadType,
  difficulty: 1 | 2 | 3,
  compound: boolean,
  stress: BodyArea[],
  cues: Bi,
  mistakes: Bi,
): Exercise => ({ id, name: { es, en }, pattern, primary, secondary, equipment, load, difficulty, compound, stress, cues, mistakes });

export const EXERCISES: Exercise[] = [
  // ---------------- Sentadilla ----------------
  ex('back_squat', 'Sentadilla con barra', 'Barbell back squat', 'squat', 'quads', ['glutes', 'core', 'lower_back'], ['barbell'], 'barbell', 3, true, ['knee', 'lower_back'],
    { es: ['Barra apoyada en la parte alta de la espalda, pies al ancho de hombros.', 'Baja controlando con el pecho alto y rodillas en la dirección de los pies.', 'Sube empujando el suelo y manteniendo la espalda neutra.'], en: ['Bar on the upper back, feet shoulder-width apart.', 'Descend under control, chest up, knees tracking over toes.', 'Drive up through the floor keeping a neutral spine.'] },
    { es: ['Redondear la zona lumbar en la parte baja.', 'Dejar que las rodillas se vayan hacia dentro.'], en: ['Rounding the lower back at the bottom.', 'Letting the knees cave inward.'] }),
  ex('goblet_squat', 'Sentadilla goblet con mancuerna', 'Dumbbell goblet squat', 'squat', 'quads', ['glutes', 'core'], ['dumbbell'], 'dumbbell', 1, true, ['knee'],
    { es: ['Sostén la mancuerna vertical frente al pecho.', 'Baja entre las piernas con el torso erguido.', 'Sube sin perder la posición de los codos.'], en: ['Hold the dumbbell upright at your chest.', 'Sit down between your legs with an upright torso.', 'Stand up keeping elbows in position.'] },
    { es: ['Despegar los talones del suelo.', 'Inclinar el torso hacia delante en exceso.'], en: ['Lifting the heels.', 'Leaning the torso too far forward.'] }),
  ex('leg_press', 'Prensa de piernas', 'Leg press', 'squat', 'quads', ['glutes', 'hamstrings'], ['machine'], 'machine', 1, true, ['knee'],
    { es: ['Espalda y cadera pegadas al respaldo.', 'Baja hasta donde la pelvis no se despegue.', 'Empuja sin bloquear las rodillas de golpe.'], en: ['Keep back and hips against the pad.', 'Lower only as far as your pelvis stays down.', 'Press without snapping the knees locked.'] },
    { es: ['Bajar tanto que la pelvis se enrolla.', 'Bloquear las rodillas con violencia.'], en: ['Going so deep the pelvis tucks.', 'Violently locking the knees.'] }),
  ex('bodyweight_squat', 'Sentadilla con peso corporal', 'Bodyweight squat', 'squat', 'quads', ['glutes'], ['bodyweight'], 'bodyweight', 1, true, ['knee'],
    { es: ['Pies al ancho de hombros, brazos al frente para equilibrio.', 'Baja controlado hasta una profundidad cómoda.', 'Sube con el peso repartido en todo el pie.'], en: ['Feet shoulder-width, arms forward for balance.', 'Lower under control to a comfortable depth.', 'Stand with weight spread over the whole foot.'] },
    { es: ['Rebotar abajo.', 'Rodillas hacia dentro.'], en: ['Bouncing at the bottom.', 'Knees caving in.'] }),
  // ---------------- Bisagra de cadera ----------------
  ex('romanian_deadlift', 'Peso muerto rumano con barra', 'Barbell Romanian deadlift', 'hinge', 'hamstrings', ['glutes', 'lower_back'], ['barbell'], 'barbell', 2, true, ['lower_back'],
    { es: ['Rodillas ligeramente flexionadas y fijas.', 'Lleva la cadera atrás deslizando la barra pegada a las piernas.', 'Sube apretando glúteos sin hiperextender la espalda.'], en: ['Knees slightly bent and fixed.', 'Push the hips back sliding the bar along the legs.', 'Stand by squeezing the glutes without over-arching.'] },
    { es: ['Redondear la espalda.', 'Convertirlo en una sentadilla doblando mucho las rodillas.'], en: ['Rounding the back.', 'Turning it into a squat by bending the knees too much.'] }),
  ex('db_romanian_deadlift', 'Peso muerto rumano con mancuernas', 'Dumbbell Romanian deadlift', 'hinge', 'hamstrings', ['glutes', 'lower_back'], ['dumbbell'], 'dumbbell', 1, true, ['lower_back'],
    { es: ['Mancuernas frente a los muslos.', 'Cadera atrás con la espalda neutra hasta sentir los isquiotibiales.', 'Vuelve arriba empujando la cadera al frente.'], en: ['Dumbbells in front of the thighs.', 'Hips back with a neutral spine until you feel the hamstrings.', 'Return by driving the hips forward.'] },
    { es: ['Bajar más allá de lo que permite la espalda neutra.', 'Alejar las mancuernas del cuerpo.'], en: ['Going lower than a neutral back allows.', 'Letting the dumbbells drift away.'] }),
  ex('kb_swing', 'Balanceo con kettlebell', 'Kettlebell swing', 'hinge', 'glutes', ['hamstrings', 'core'], ['kettlebell'], 'kettlebell', 2, true, ['lower_back'],
    { es: ['Movimiento de cadera, no de brazos.', 'Lleva la pesa entre las piernas y extiende la cadera con fuerza.', 'Tronco firme arriba, como en una plancha de pie.'], en: ['Hip-driven, not arm-driven.', 'Hike the bell back and snap the hips forward.', 'Brace at the top like a standing plank.'] },
    { es: ['Hacer una sentadilla en lugar de bisagra.', 'Levantar con los brazos o hiperextender la espalda.'], en: ['Squatting instead of hinging.', 'Lifting with the arms or leaning back at the top.'] }),
  ex('band_good_morning', 'Buenos días con banda', 'Band good morning', 'hinge', 'hamstrings', ['glutes', 'lower_back'], ['bands'], 'band', 1, true, ['lower_back'],
    { es: ['Pisa la banda y pásala por detrás del cuello sobre los hombros.', 'Inclina el tronco llevando la cadera atrás.', 'Vuelve arriba apretando glúteos.'], en: ['Stand on the band and loop it behind your neck over the shoulders.', 'Hinge forward pushing the hips back.', 'Return by squeezing the glutes.'] },
    { es: ['Redondear la espalda.', 'Usar una banda demasiado tensa al inicio.'], en: ['Rounding the back.', 'Using a band that is too heavy at first.'] }),
  // ---------------- Zancadas ----------------
  ex('db_reverse_lunge', 'Zancada hacia atrás con mancuernas', 'Dumbbell reverse lunge', 'lunge', 'quads', ['glutes', 'hamstrings'], ['dumbbell'], 'dumbbell', 1, true, ['knee'],
    { es: ['Da un paso atrás y baja la rodilla trasera cerca del suelo.', 'El peso va en el pie delantero.', 'Regresa empujando con el talón delantero.'], en: ['Step back and lower the back knee toward the floor.', 'Keep weight on the front foot.', 'Return by pushing through the front heel.'] },
    { es: ['Paso demasiado corto.', 'Perder el equilibrio por mirar abajo.'], en: ['Taking too short a step.', 'Losing balance by looking down.'] }),
  ex('bulgarian_split_squat', 'Sentadilla búlgara', 'Bulgarian split squat', 'lunge', 'quads', ['glutes'], ['dumbbell', 'bench'], 'dumbbell', 2, true, ['knee'],
    { es: ['Empeine trasero sobre el banco.', 'Baja vertical sobre la pierna delantera.', 'Sube con el torso estable.'], en: ['Rear foot laces on the bench.', 'Lower straight down over the front leg.', 'Rise with a stable torso.'] },
    { es: ['Pie delantero demasiado cerca del banco.', 'Empujar con la pierna trasera.'], en: ['Front foot too close to the bench.', 'Pushing with the back leg.'] }),
  ex('bw_reverse_lunge', 'Zancada hacia atrás con peso corporal', 'Bodyweight reverse lunge', 'lunge', 'quads', ['glutes'], ['bodyweight'], 'bodyweight', 1, true, ['knee'],
    { es: ['Paso atrás controlado.', 'Rodilla trasera cerca del suelo sin golpearlo.', 'Regresa empujando con la pierna delantera.'], en: ['Controlled step back.', 'Back knee near the floor without hitting it.', 'Return pushing through the front leg.'] },
    { es: ['Inclinar el torso hacia delante.', 'Rodilla delantera hacia dentro.'], en: ['Leaning the torso forward.', 'Front knee caving in.'] }),
  ex('step_up', 'Subida al banco con mancuernas', 'Dumbbell step-up', 'lunge', 'quads', ['glutes'], ['dumbbell', 'bench'], 'dumbbell', 1, true, ['knee'],
    { es: ['Coloca todo el pie en el banco.', 'Sube empujando con la pierna de arriba.', 'Baja despacio sin dejarte caer.'], en: ['Place the whole foot on the bench.', 'Drive up with the top leg.', 'Lower slowly without dropping.'] },
    { es: ['Impulsarse con la pierna de abajo.', 'Usar un banco demasiado alto.'], en: ['Pushing off the bottom leg.', 'Using a box that is too high.'] }),
  // ---------------- Empuje horizontal ----------------
  ex('bench_press', 'Press de banca con barra', 'Barbell bench press', 'h_push', 'chest', ['triceps', 'front_delts'], ['barbell', 'bench'], 'barbell', 2, true, ['shoulder', 'wrist'],
    { es: ['Escápulas juntas y hacia abajo, pies firmes.', 'Baja la barra a la parte media del pecho con los codos a unos 45–70°.', 'Empuja hacia arriba y ligeramente hacia atrás. Usa ayudante o topes de seguridad.'], en: ['Shoulder blades pinched down, feet planted.', 'Lower the bar to mid-chest with elbows at about 45–70°.', 'Press up and slightly back. Use a spotter or safety pins.'] },
    { es: ['Rebotar la barra en el pecho.', 'Codos completamente abiertos a 90°.'], en: ['Bouncing the bar off the chest.', 'Flaring elbows to 90°.'] }),
  ex('db_bench_press', 'Press de banca con mancuernas', 'Dumbbell bench press', 'h_push', 'chest', ['triceps', 'front_delts'], ['dumbbell', 'bench'], 'dumbbell', 1, true, ['shoulder'],
    { es: ['Escápulas retraídas sobre el banco.', 'Baja las mancuernas a los lados del pecho.', 'Sube juntándolas ligeramente arriba.'], en: ['Shoulder blades retracted on the bench.', 'Lower the dumbbells beside the chest.', 'Press up bringing them slightly together.'] },
    { es: ['Bajar demasiado y forzar el hombro.', 'Perder el control arriba.'], en: ['Lowering too far and straining the shoulder.', 'Losing control at the top.'] }),
  ex('incline_db_press', 'Press inclinado con mancuernas', 'Incline dumbbell press', 'h_push', 'chest', ['front_delts', 'triceps'], ['dumbbell', 'bench'], 'dumbbell', 1, true, ['shoulder'],
    { es: ['Banco a 30–45°.', 'Baja controlado hacia la parte alta del pecho.', 'Empuja sin arquear en exceso.'], en: ['Bench at 30–45°.', 'Lower under control toward the upper chest.', 'Press without excessive arching.'] },
    { es: ['Banco demasiado vertical (se vuelve press de hombro).', 'Despegar la cadera.'], en: ['Bench too upright (turns into a shoulder press).', 'Lifting the hips.'] }),
  ex('machine_chest_press', 'Press de pecho en máquina', 'Machine chest press', 'h_push', 'chest', ['triceps', 'front_delts'], ['machine'], 'machine', 1, true, ['shoulder'],
    { es: ['Ajusta el asiento: agarres a la altura del pecho medio.', 'Empuja sin despegar la espalda.', 'Regresa lento.'], en: ['Set the seat so handles are at mid-chest.', 'Press without lifting your back off the pad.', 'Return slowly.'] },
    { es: ['Asiento mal ajustado.', 'Soltar el peso de golpe.'], en: ['Seat set at the wrong height.', 'Letting the weight crash back.'] }),
  ex('push_up', 'Flexiones de brazos', 'Push-up', 'h_push', 'chest', ['triceps', 'front_delts', 'core'], ['bodyweight'], 'bodyweight', 1, true, ['wrist', 'shoulder'],
    { es: ['Cuerpo en línea recta de cabeza a talones.', 'Baja el pecho entre las manos con codos a unos 45°.', 'Si cuesta, apoya las manos en una superficie elevada.'], en: ['Body in a straight line from head to heels.', 'Lower your chest between your hands with elbows at about 45°.', 'If too hard, elevate your hands on a sturdy surface.'] },
    { es: ['Dejar caer la cadera.', 'Hacer repeticiones a medias.'], en: ['Sagging hips.', 'Doing half reps.'] }),
  // ---------------- Empuje vertical ----------------
  ex('overhead_press', 'Press militar con barra', 'Barbell overhead press', 'v_push', 'front_delts', ['triceps', 'side_delts', 'core'], ['barbell'], 'barbell', 3, true, ['shoulder', 'lower_back'],
    { es: ['Glúteos y abdomen firmes.', 'Empuja la barra en línea recta pasando la cara.', 'Termina con la barra sobre la mitad del pie.'], en: ['Glutes and abs braced.', 'Press the bar straight up past your face.', 'Finish with the bar over mid-foot.'] },
    { es: ['Arquear la zona lumbar.', 'Empujar la barra hacia delante.'], en: ['Arching the lower back.', 'Pressing the bar forward.'] }),
  ex('db_shoulder_press', 'Press de hombro con mancuernas', 'Dumbbell shoulder press', 'v_push', 'front_delts', ['triceps', 'side_delts'], ['dumbbell'], 'dumbbell', 1, true, ['shoulder'],
    { es: ['Mancuernas a la altura de los hombros.', 'Empuja hacia arriba sin chocar las pesas.', 'Baja controlado.'], en: ['Dumbbells at shoulder height.', 'Press up without clashing them.', 'Lower under control.'] },
    { es: ['Arquear la espalda.', 'Bajar demasiado rápido.'], en: ['Arching the back.', 'Lowering too fast.'] }),
  ex('machine_shoulder_press', 'Press de hombro en máquina', 'Machine shoulder press', 'v_push', 'front_delts', ['triceps', 'side_delts'], ['machine'], 'machine', 1, true, ['shoulder'],
    { es: ['Agarres a la altura de los hombros.', 'Empuja sin bloquear de golpe.', 'Espalda apoyada.'], en: ['Handles at shoulder height.', 'Press without slamming into lockout.', 'Back supported.'] },
    { es: ['Asiento demasiado bajo.', 'Rebote abajo.'], en: ['Seat too low.', 'Bouncing at the bottom.'] }),
  ex('pike_push_up', 'Flexión en pica', 'Pike push-up', 'v_push', 'front_delts', ['triceps'], ['bodyweight'], 'bodyweight', 2, true, ['shoulder', 'wrist'],
    { es: ['Cadera alta formando una V invertida.', 'Baja la cabeza entre las manos.', 'Empuja de vuelta manteniendo la cadera alta.'], en: ['Hips high in an inverted V.', 'Lower your head between your hands.', 'Press back keeping hips high.'] },
    { es: ['Convertirlo en flexión normal.', 'Golpear la cabeza en el suelo.'], en: ['Turning it into a regular push-up.', 'Hitting the head on the floor.'] }),
  ex('band_overhead_press', 'Press de hombro con banda', 'Band overhead press', 'v_push', 'front_delts', ['triceps', 'side_delts'], ['bands'], 'band', 1, true, ['shoulder'],
    { es: ['Pisa la banda con ambos pies.', 'Empuja hacia arriba con el abdomen firme.', 'Baja despacio.'], en: ['Stand on the band with both feet.', 'Press up with abs braced.', 'Lower slowly.'] },
    { es: ['Arquear la espalda.', 'Soltar la tensión de golpe.'], en: ['Arching the back.', 'Letting the band snap back.'] }),
  // ---------------- Tirón horizontal ----------------
  ex('barbell_row', 'Remo con barra', 'Barbell row', 'h_pull', 'upper_back', ['lats', 'biceps', 'lower_back'], ['barbell'], 'barbell', 2, true, ['lower_back'],
    { es: ['Torso inclinado a unos 45° con espalda neutra.', 'Lleva la barra hacia el ombligo.', 'Baja con control.'], en: ['Torso at about 45° with a neutral back.', 'Row the bar toward your belly button.', 'Lower under control.'] },
    { es: ['Usar impulso del torso.', 'Redondear la espalda.'], en: ['Using torso momentum.', 'Rounding the back.'] }),
  ex('one_arm_db_row', 'Remo a una mano con mancuerna', 'One-arm dumbbell row', 'h_pull', 'lats', ['upper_back', 'biceps'], ['dumbbell', 'bench'], 'dumbbell', 1, true, [],
    { es: ['Mano y rodilla apoyadas en el banco.', 'Lleva la mancuerna hacia la cadera.', 'Baja estirando sin girar el torso.'], en: ['Hand and knee on the bench.', 'Pull the dumbbell toward your hip.', 'Lower fully without twisting.'] },
    { es: ['Girar el torso para subir más peso.', 'Encoger el hombro.'], en: ['Twisting the torso to lift more.', 'Shrugging the shoulder.'] }),
  ex('seated_cable_row', 'Remo sentado en polea', 'Seated cable row', 'h_pull', 'upper_back', ['lats', 'biceps'], ['cable'], 'cable', 1, true, [],
    { es: ['Pecho alto y espalda neutra.', 'Lleva el agarre al abdomen juntando escápulas.', 'Regresa sin redondear la espalda.'], en: ['Chest up, neutral back.', 'Pull the handle to your abdomen squeezing the shoulder blades.', 'Return without rounding.'] },
    { es: ['Balancear el torso.', 'Tirar sólo con los brazos.'], en: ['Rocking the torso.', 'Pulling only with the arms.'] }),
  ex('chest_supported_row', 'Remo con pecho apoyado en máquina', 'Chest-supported machine row', 'h_pull', 'upper_back', ['lats', 'rear_delts', 'biceps'], ['machine'], 'machine', 1, true, [],
    { es: ['Pecho apoyado en el soporte.', 'Tira con los codos hacia atrás.', 'Pausa breve con escápulas juntas.'], en: ['Chest on the pad.', 'Drive the elbows back.', 'Brief pause with shoulder blades squeezed.'] },
    { es: ['Despegar el pecho del soporte.', 'Recorrido corto.'], en: ['Lifting the chest off the pad.', 'Short range of motion.'] }),
  ex('band_row', 'Remo con banda', 'Band row', 'h_pull', 'upper_back', ['lats', 'biceps'], ['bands'], 'band', 1, true, [],
    { es: ['Ancla la banda a la altura del pecho.', 'Tira llevando los codos atrás.', 'Regresa despacio.'], en: ['Anchor the band at chest height.', 'Pull driving the elbows back.', 'Return slowly.'] },
    { es: ['Anclaje inseguro.', 'Encoger hombros.'], en: ['Insecure anchor.', 'Shrugging.'] }),
  // ---------------- Tirón vertical ----------------
  ex('pull_up', 'Dominadas', 'Pull-up', 'v_pull', 'lats', ['biceps', 'upper_back'], ['pullup_bar'], 'bodyweight', 3, true, ['shoulder', 'elbow'],
    { es: ['Agarre algo más ancho que los hombros.', 'Sube llevando el pecho hacia la barra.', 'Baja hasta extender los brazos con control. Usa banda de asistencia si hace falta.'], en: ['Grip slightly wider than shoulders.', 'Pull your chest toward the bar.', 'Lower to full extension under control. Use an assistance band if needed.'] },
    { es: ['Balancearse.', 'Hacer medias repeticiones.'], en: ['Kipping/swinging.', 'Half reps.'] }),
  ex('lat_pulldown', 'Jalón al pecho en polea', 'Lat pulldown', 'v_pull', 'lats', ['biceps', 'upper_back'], ['cable'], 'cable', 1, true, [],
    { es: ['Muslos fijos bajo el soporte.', 'Lleva la barra a la parte alta del pecho.', 'Sube controlando sin soltar los hombros de golpe.'], en: ['Thighs secured under the pad.', 'Pull the bar to your upper chest.', 'Return under control.'] },
    { es: ['Jalar detrás de la nuca.', 'Echarse muy atrás.'], en: ['Pulling behind the neck.', 'Leaning too far back.'] }),
  ex('band_pulldown', 'Jalón con banda', 'Band pulldown', 'v_pull', 'lats', ['biceps'], ['bands'], 'band', 1, true, [],
    { es: ['Ancla la banda en un punto alto y seguro.', 'Lleva los codos hacia las costillas.', 'Regresa despacio.'], en: ['Anchor the band high and secure.', 'Drive the elbows to your ribs.', 'Return slowly.'] },
    { es: ['Anclaje inseguro.', 'Tirar con impulso.'], en: ['Insecure anchor.', 'Using momentum.'] }),
  // ---------------- Isquiotibiales / cuádriceps aislados ----------------
  ex('lying_leg_curl', 'Curl femoral en máquina', 'Machine leg curl', 'knee_flex', 'hamstrings', [], ['machine'], 'machine', 1, false, ['knee'],
    { es: ['Rodillas alineadas con el eje de la máquina.', 'Flexiona hasta el máximo cómodo.', 'Baja lento.'], en: ['Knees aligned with the machine pivot.', 'Curl to your comfortable end range.', 'Lower slowly.'] },
    { es: ['Levantar la cadera.', 'Bajar de golpe.'], en: ['Lifting the hips.', 'Dropping the weight.'] }),
  ex('slider_leg_curl', 'Curl femoral deslizante', 'Slider leg curl', 'knee_flex', 'hamstrings', ['glutes'], ['bodyweight'], 'bodyweight', 2, false, ['knee'],
    { es: ['Boca arriba, talones sobre toallas en suelo liso.', 'Eleva la cadera y lleva los talones hacia ti.', 'Extiende despacio.'], en: ['On your back, heels on towels on a smooth floor.', 'Lift your hips and pull your heels in.', 'Extend slowly.'] },
    { es: ['Dejar caer la cadera.', 'Movimientos bruscos.'], en: ['Letting the hips drop.', 'Jerky movements.'] }),
  ex('band_leg_curl', 'Curl femoral con banda', 'Band leg curl', 'knee_flex', 'hamstrings', [], ['bands'], 'band', 1, false, ['knee'],
    { es: ['Boca abajo con la banda anclada en los tobillos.', 'Flexiona las rodillas sin levantar la cadera.', 'Regresa lento.'], en: ['Face down with the band anchored at the ankles.', 'Curl without lifting the hips.', 'Return slowly.'] },
    { es: ['Anclaje inestable.', 'Arquear la espalda.'], en: ['Unstable anchor.', 'Arching the back.'] }),
  ex('leg_extension', 'Extensión de cuádriceps en máquina', 'Leg extension', 'knee_ext', 'quads', [], ['machine'], 'machine', 1, false, ['knee'],
    { es: ['Rodilla alineada con el eje.', 'Extiende hasta casi bloquear.', 'Baja controlado.'], en: ['Knee aligned with the pivot.', 'Extend to near lockout.', 'Lower under control.'] },
    { es: ['Usar impulso.', 'Rango que provoca molestia en la rodilla.'], en: ['Using momentum.', 'Using a range that irritates the knee.'] }),
  ex('band_leg_extension', 'Extensión de cuádriceps con banda', 'Band leg extension', 'knee_ext', 'quads', [], ['bands'], 'band', 1, false, ['knee'],
    { es: ['Sentado, banda anclada detrás del tobillo.', 'Extiende la rodilla.', 'Regresa lento.'], en: ['Seated, band anchored behind the ankle.', 'Extend the knee.', 'Return slowly.'] },
    { es: ['Anclaje inseguro.', 'Movimiento brusco.'], en: ['Insecure anchor.', 'Jerky movement.'] }),
  // ---------------- Glúteo y pantorrilla ----------------
  ex('hip_thrust', 'Empuje de cadera con barra', 'Barbell hip thrust', 'glute', 'glutes', ['hamstrings'], ['barbell', 'bench'], 'barbell', 2, true, ['hip'],
    { es: ['Espalda alta apoyada en el banco y barra acolchada sobre la cadera.', 'Empuja con los talones hasta alinear rodillas, cadera y hombros.', 'Barbilla ligeramente metida.'], en: ['Upper back on the bench, padded bar over the hips.', 'Drive through the heels until knees, hips and shoulders align.', 'Chin slightly tucked.'] },
    { es: ['Hiperextender la zona lumbar arriba.', 'Pies demasiado lejos.'], en: ['Over-arching the lower back at the top.', 'Feet too far away.'] }),
  ex('glute_bridge', 'Puente de glúteo', 'Glute bridge', 'glute', 'glutes', ['hamstrings'], ['bodyweight'], 'bodyweight', 1, false, [],
    { es: ['Boca arriba, rodillas flexionadas.', 'Eleva la cadera apretando glúteos.', 'Pausa 1 segundo arriba (puedes sostener una mancuerna).'], en: ['On your back, knees bent.', 'Lift the hips squeezing the glutes.', 'Pause 1 second at the top (you can hold a dumbbell).'] },
    { es: ['Arquear la espalda en lugar de extender la cadera.', 'Empujar con las puntas.'], en: ['Arching the back instead of extending the hips.', 'Pushing through the toes.'] }),
  ex('standing_calf_raise', 'Elevación de talones de pie', 'Standing calf raise', 'calf', 'calves', [], ['bodyweight'], 'bodyweight', 1, false, ['ankle'],
    { es: ['Puntas sobre un escalón, talones fuera.', 'Sube lo más alto posible.', 'Baja hasta estirar sin rebotar.'], en: ['Balls of the feet on a step, heels off.', 'Rise as high as possible.', 'Lower into a stretch without bouncing.'] },
    { es: ['Rebotar.', 'Recorrido corto.'], en: ['Bouncing.', 'Short range of motion.'] }),
  ex('machine_calf_raise', 'Elevación de talones en máquina', 'Machine calf raise', 'calf', 'calves', [], ['machine'], 'machine', 1, false, ['ankle'],
    { es: ['Rodillas casi extendidas.', 'Pausa arriba y abajo.', 'Movimiento controlado.'], en: ['Knees nearly straight.', 'Pause at the top and bottom.', 'Controlled tempo.'] },
    { es: ['Rebotar.', 'Doblar las rodillas para ayudarse.'], en: ['Bouncing.', 'Bending the knees to help.'] }),
  // ---------------- Hombro ----------------
  ex('db_lateral_raise', 'Elevaciones laterales con mancuernas', 'Dumbbell lateral raise', 'lat_delt', 'side_delts', [], ['dumbbell'], 'dumbbell', 1, false, ['shoulder'],
    { es: ['Codos ligeramente flexionados.', 'Sube hasta la altura de los hombros.', 'Baja despacio.'], en: ['Elbows slightly bent.', 'Raise to shoulder height.', 'Lower slowly.'] },
    { es: ['Usar impulso.', 'Subir encogiendo los hombros.'], en: ['Swinging the weights.', 'Shrugging as you lift.'] }),
  ex('cable_lateral_raise', 'Elevación lateral en polea', 'Cable lateral raise', 'lat_delt', 'side_delts', [], ['cable'], 'cable', 1, false, ['shoulder'],
    { es: ['Polea baja, agarre con la mano contraria.', 'Eleva el brazo hasta la altura del hombro.', 'Regresa controlado.'], en: ['Low pulley, opposite-hand grip.', 'Raise the arm to shoulder height.', 'Return under control.'] },
    { es: ['Inclinar el cuerpo.', 'Subir por encima del hombro.'], en: ['Leaning the body.', 'Raising above shoulder height.'] }),
  ex('band_lateral_raise', 'Elevación lateral con banda', 'Band lateral raise', 'lat_delt', 'side_delts', [], ['bands'], 'band', 1, false, ['shoulder'],
    { es: ['Pisa la banda.', 'Eleva los brazos a los lados.', 'Baja despacio.'], en: ['Stand on the band.', 'Raise the arms out to the sides.', 'Lower slowly.'] },
    { es: ['Encoger los hombros.', 'Banda demasiado tensa.'], en: ['Shrugging.', 'Band too heavy.'] }),
  ex('face_pull', 'Face pull en polea', 'Cable face pull', 'rear_delt', 'rear_delts', ['upper_back'], ['cable'], 'cable', 1, false, [],
    { es: ['Polea a la altura de la cara con cuerda.', 'Tira hacia la frente separando las manos.', 'Codos altos.'], en: ['Pulley at face height with a rope.', 'Pull toward your forehead, hands apart.', 'Elbows high.'] },
    { es: ['Usar demasiado peso.', 'Echarse hacia atrás.'], en: ['Going too heavy.', 'Leaning back.'] }),
  ex('band_pull_apart', 'Aperturas con banda', 'Band pull-apart', 'rear_delt', 'rear_delts', ['upper_back'], ['bands'], 'band', 1, false, [],
    { es: ['Brazos al frente sujetando la banda.', 'Separa las manos hasta el pecho.', 'Regresa controlado.'], en: ['Arms in front holding the band.', 'Pull your hands apart to your chest.', 'Return under control.'] },
    { es: ['Encoger hombros.', 'Arquear la espalda.'], en: ['Shrugging.', 'Arching the back.'] }),
  ex('db_rear_delt_fly', 'Pájaros con mancuernas', 'Dumbbell rear-delt fly', 'rear_delt', 'rear_delts', ['upper_back'], ['dumbbell'], 'dumbbell', 1, false, ['lower_back'],
    { es: ['Inclina el torso con espalda neutra.', 'Abre los brazos a los lados.', 'Baja despacio.'], en: ['Hinge forward with a neutral back.', 'Raise the arms out to the sides.', 'Lower slowly.'] },
    { es: ['Usar impulso.', 'Redondear la espalda.'], en: ['Using momentum.', 'Rounding the back.'] }),
  // ---------------- Brazos ----------------
  ex('db_curl', 'Curl de bíceps con mancuernas', 'Dumbbell biceps curl', 'biceps', 'biceps', [], ['dumbbell'], 'dumbbell', 1, false, ['elbow'],
    { es: ['Codos pegados al cuerpo.', 'Flexiona sin balancear el torso.', 'Baja hasta extender.'], en: ['Elbows by your sides.', 'Curl without swinging.', 'Lower to full extension.'] },
    { es: ['Balancear el cuerpo.', 'Mover los codos hacia delante.'], en: ['Swinging the body.', 'Moving the elbows forward.'] }),
  ex('cable_curl', 'Curl de bíceps en polea', 'Cable biceps curl', 'biceps', 'biceps', [], ['cable'], 'cable', 1, false, ['elbow'],
    { es: ['Polea baja.', 'Codos fijos.', 'Pausa arriba y baja lento.'], en: ['Low pulley.', 'Elbows fixed.', 'Pause at the top and lower slowly.'] },
    { es: ['Inclinarse atrás.', 'Recorrido corto.'], en: ['Leaning back.', 'Short range.'] }),
  ex('band_curl', 'Curl de bíceps con banda', 'Band biceps curl', 'biceps', 'biceps', [], ['bands'], 'band', 1, false, ['elbow'],
    { es: ['Pisa la banda.', 'Codos fijos al cuerpo.', 'Baja despacio.'], en: ['Stand on the band.', 'Elbows fixed.', 'Lower slowly.'] },
    { es: ['Balancearse.', 'Soltar la banda de golpe.'], en: ['Swinging.', 'Letting the band snap.'] }),
  ex('cable_pushdown', 'Extensión de tríceps en polea', 'Cable triceps pushdown', 'triceps', 'triceps', [], ['cable'], 'cable', 1, false, ['elbow'],
    { es: ['Codos pegados al cuerpo.', 'Extiende completamente.', 'Sube controlado.'], en: ['Elbows tucked.', 'Extend fully.', 'Return under control.'] },
    { es: ['Mover los hombros.', 'Inclinarse sobre la barra.'], en: ['Moving the shoulders.', 'Leaning over the bar.'] }),
  ex('db_overhead_extension', 'Extensión de tríceps sobre la cabeza', 'Dumbbell overhead triceps extension', 'triceps', 'triceps', [], ['dumbbell'], 'dumbbell', 1, false, ['elbow', 'shoulder'],
    { es: ['Sujeta una mancuerna con ambas manos sobre la cabeza.', 'Baja detrás de la cabeza flexionando los codos.', 'Extiende sin abrir los codos.'], en: ['Hold one dumbbell overhead with both hands.', 'Lower behind your head bending the elbows.', 'Extend without flaring.'] },
    { es: ['Arquear la espalda.', 'Abrir los codos.'], en: ['Arching the back.', 'Flaring the elbows.'] }),
  ex('band_pushdown', 'Extensión de tríceps con banda', 'Band triceps pushdown', 'triceps', 'triceps', [], ['bands'], 'band', 1, false, ['elbow'],
    { es: ['Ancla la banda en alto.', 'Codos fijos al cuerpo.', 'Extiende y regresa lento.'], en: ['Anchor the band high.', 'Elbows fixed.', 'Extend and return slowly.'] },
    { es: ['Anclaje inseguro.', 'Mover los hombros.'], en: ['Insecure anchor.', 'Moving the shoulders.'] }),
  // ---------------- Core ----------------
  ex('plank', 'Plancha', 'Plank', 'core', 'core', [], ['bodyweight'], 'bodyweight', 1, false, [],
    { es: ['Antebrazos bajo los hombros.', 'Cuerpo en línea recta, glúteos apretados.', 'Respira sin perder la posición.'], en: ['Forearms under shoulders.', 'Body in a straight line, glutes squeezed.', 'Breathe without losing position.'] },
    { es: ['Cadera caída o muy elevada.', 'Aguantar la respiración.'], en: ['Hips sagging or piked.', 'Holding your breath.'] }),
  ex('dead_bug', 'Dead bug', 'Dead bug', 'core', 'core', [], ['bodyweight'], 'bodyweight', 1, false, [],
    { es: ['Boca arriba, brazos y rodillas a 90°.', 'Extiende brazo y pierna contrarios manteniendo la zona lumbar pegada al suelo.', 'Alterna lento.'], en: ['On your back, arms up and knees at 90°.', 'Extend opposite arm and leg keeping the lower back down.', 'Alternate slowly.'] },
    { es: ['Despegar la zona lumbar.', 'Ir demasiado rápido.'], en: ['Lifting the lower back.', 'Going too fast.'] }),
  ex('pallof_press', 'Press Pallof en polea', 'Cable Pallof press', 'core', 'core', [], ['cable'], 'cable', 1, false, [],
    { es: ['De lado a la polea a la altura del pecho.', 'Extiende los brazos sin dejar que el torso gire.', 'Regresa al pecho.'], en: ['Stand side-on to the pulley at chest height.', 'Press out without letting the torso rotate.', 'Return to the chest.'] },
    { es: ['Girar el torso.', 'Posición de pies demasiado estrecha.'], en: ['Rotating the torso.', 'Stance too narrow.'] }),
  ex('band_pallof_press', 'Press Pallof con banda', 'Band Pallof press', 'core', 'core', [], ['bands'], 'band', 1, false, [],
    { es: ['Ancla la banda a la altura del pecho.', 'Extiende los brazos resistiendo la rotación.', 'Regresa despacio.'], en: ['Anchor the band at chest height.', 'Press out resisting rotation.', 'Return slowly.'] },
    { es: ['Girar el torso.', 'Anclaje inseguro.'], en: ['Rotating the torso.', 'Insecure anchor.'] }),
];

export const EXERCISE_BY_ID: Record<string, Exercise> = Object.fromEntries(EXERCISES.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise {
  const e = EXERCISE_BY_ID[id];
  if (!e) throw new Error(`Ejercicio desconocido: ${id}`);
  return e;
}
