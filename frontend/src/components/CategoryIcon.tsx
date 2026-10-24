// Pick the right icon for a product. Centralised so we can later
// swap in "use uploaded photo if present" without touching call sites.

import type { ProductCategory } from "@/types/models";
import {
  MilkIcon,
  YoghurtIcon,
  ButterIcon,
  CheeseIcon,
  PackageIcon,
} from "@/components/icons/CategoryIcons";
import { colors } from "@/styles/tokens";

type Props = {
  category: ProductCategory;
  size?: number;
};

export default function CategoryIcon({ category, size = 24 }: Props) {
  switch (category) {
    case "milk":
      return <MilkIcon size={size} color={colors.milkFg} />;
    case "yoghurt":
      return <YoghurtIcon size={size} color={colors.yoghurtFg} />;
    case "butter":
      return <ButterIcon size={size} color={colors.butterFg} />;
    case "cheese":
      return <CheeseIcon size={size} color={colors.cheeseFg} />;
    default:
      return <PackageIcon size={size} color={colors.otherFg} />;
  }
}

/** Background tint for a category — used on tiles and inventory rows. */
export function categoryTint(category: ProductCategory): { bg: string; fg: string } {
  switch (category) {
    case "milk":    return { bg: colors.milk,    fg: colors.milkFg };
    case "yoghurt": return { bg: colors.yoghurt, fg: colors.yoghurtFg };
    case "butter":  return { bg: colors.butter,  fg: colors.butterFg };
    case "cheese":  return { bg: colors.cheese,  fg: colors.cheeseFg };
    default:        return { bg: colors.other,   fg: colors.otherFg };
  }
}