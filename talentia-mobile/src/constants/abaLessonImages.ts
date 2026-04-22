import type { ImageSourcePropType } from 'react-native';

/**
 * Keys referenced by LessonTask imageKey / illustrationKey (ABA tasks).
 * Reuses existing bundled PNGs until dedicated art exists.
 */
const ABA_IMAGES: Record<string, ImageSourcePropType> = {
  aba_scene_fruit: require('../../assets/images/ui/ui-gift.png'),
  aba_apple: require('../../assets/images/ui/ui-heart.png'),
  aba_banana: require('../../assets/images/ui/ui-stars.png'),
  aba_cat: require('../../assets/images/npcs/npc-fedya.png'),
  aba_dog: require('../../assets/images/npcs/npc-pete.png'),
  aba_bird: require('../../assets/images/npcs/npc-tara.png'),
  aba_fish: require('../../assets/images/npcs/npc-zoya.png'),
  aba_room_tv: require('../../assets/images/ui/ui-book.png'),
  aba_room_bed: require('../../assets/images/ui/ui-book-bookmark.png'),
  aba_room_kitchen: require('../../assets/images/ui/ui-bulb.png'),
  aba_sort_food: require('../../assets/images/ui/ui-egg.png'),
  aba_sort_toy: require('../../assets/images/ui/ui-trophy.png'),
  aba_routine_brush: require('../../assets/images/ui/ui-pencil-paper.png'),
  aba_routine_paste: require('../../assets/images/ui/ui-medal.png'),
  aba_routine_rinse: require('../../assets/images/ui/ui-flame.png'),
  aba_routine_wet: require('../../assets/images/ui/ui-lightning.png'),
  aba_routine_wash_tap: require('../../assets/images/aba/routine_wash_tap.png'),
  aba_routine_wash_soap: require('../../assets/images/aba/routine_wash_soap.png'),
  aba_routine_wash_rinse: require('../../assets/images/aba/routine_wash_rinse.png'),
  aba_routine_wash_dry: require('../../assets/images/aba/routine_wash_dry.png'),
  aba_routine_sleep_pajamas: require('../../assets/images/aba/routine_sleep_pajamas.png'),
  aba_routine_sleep_teeth: require('../../assets/images/aba/routine_sleep_teeth.png'),
  aba_routine_sleep_read: require('../../assets/images/aba/routine_sleep_read.png'),
  aba_routine_sleep_sleep: require('../../assets/images/aba/routine_sleep_sleep.png'),
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
