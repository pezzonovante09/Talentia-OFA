import type { ImageSourcePropType } from 'react-native';

/**
 * Keys referenced by LessonTask imageKey / illustrationKey (ABA tasks).
 *
 * Audit (asset wiring): keys aba_apple … aba_sort_toy and rooms use real ABA PNGs.
 * Keys below (routine demo wet/paste/brush/rinse, action_*, match_*, volume) still
 * point at ui-*.png placeholders until matching aba_*.png assets exist — then only
 * swap the require() paths here; worlds.ts imageKey names stay the same.
 */
const ABA_IMAGES: Record<string, ImageSourcePropType> = {
  aba_scene_fruit: require('../../assets/images/aba/aba_sort_food.webp'),
  aba_apple: require('../../assets/images/aba/aba_apple.webp'),
  aba_banana: require('../../assets/images/aba/aba_banana.webp'),
  aba_cat: require('../../assets/images/aba/aba_cat.webp'),
  aba_dog: require('../../assets/images/aba/aba_dog.webp'),
  aba_bird: require('../../assets/images/aba/aba_bird.webp'),
  aba_fish: require('../../assets/images/aba/aba_fish.webp'),
  aba_room_tv: require('../../assets/images/aba/aba_room_tv.webp'),
  aba_room_bed: require('../../assets/images/aba/aba_room_bed.webp'),
  aba_room_kitchen: require('../../assets/images/aba/aba_room_kitchen.webp'),
  aba_sort_food: require('../../assets/images/aba/aba_sort_food.webp'),
  aba_sort_toy: require('../../assets/images/aba/aba_sort_toy.webp'),
  aba_routine_brush: require('../../assets/images/ui/ui-pencil-paper.png'),
  aba_routine_paste: require('../../assets/images/ui/ui-medal.png'),
  aba_routine_rinse: require('../../assets/images/ui/ui-flame.png'),
  aba_routine_wet: require('../../assets/images/ui/ui-lightning.png'),
  aba_routine_wash_tap: require('../../assets/images/aba/routine_wash_tap.webp'),
  aba_routine_wash_soap: require('../../assets/images/aba/routine_wash_soap.webp'),
  aba_routine_wash_rinse: require('../../assets/images/aba/routine_wash_rinse.webp'),
  aba_routine_wash_dry: require('../../assets/images/aba/routine_wash_dry.webp'),
  aba_routine_sleep_pajamas: require('../../assets/images/aba/routine_sleep_pajamas.webp'),
  aba_routine_sleep_teeth: require('../../assets/images/aba/routine_sleep_teeth.webp'),
  aba_routine_sleep_read: require('../../assets/images/aba/routine_sleep_read.webp'),
  aba_routine_sleep_sleep: require('../../assets/images/aba/routine_sleep_sleep.webp'),
  aba_action_clap: require('../../assets/images/ui/ui-streak.png'),
  aba_action_jump: require('../../assets/images/ui/ui-meteor.png'),
  aba_action_blow: require('../../assets/images/ui/ui-bulb.png'),
  aba_match_sun: require('../../assets/images/ui/ui-map.png'),
  aba_match_moon: require('../../assets/images/ui/ui-lock.png'),
  aba_match_star: require('../../assets/images/ui/ui-stars.png'),
  aba_volume_illustration: require('../../assets/images/ui/ui-help.png'),
};

export function getAbaLessonImage(key: string): ImageSourcePropType | undefined {
  return ABA_IMAGES[key];
}
