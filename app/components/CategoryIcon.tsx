import {
  GraduationCap,
  Drama,
  Cross,
  BookOpen,
  PawPrint,
  Dumbbell,
  Utensils,
  Home,
  SquareParking,
  MapPin,
  type LucideIcon,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Academic: GraduationCap,
  "Arts & Performance": Drama,
  Medical: Cross,
  Library: BookOpen,
  "Student Life": PawPrint,
  Recreation: Dumbbell,
  Dining: Utensils,
  Housing: Home,
  Parking: SquareParking,
};

interface CategoryIconProps {
  category?: string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({
  category,
  size = 14,
  className = "",
}: CategoryIconProps) {
  const Icon = (category && CATEGORY_ICONS[category]) || MapPin;
  return <Icon size={size} className={className} aria-hidden />;
}
