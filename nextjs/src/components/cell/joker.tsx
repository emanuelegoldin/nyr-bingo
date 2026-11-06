import { cn } from "@/lib/utils"
import { Star } from "lucide-react"
import { useTranslations } from "next-intl"
import { Cell } from "./cell"

export const JokerCell = () => {
    const t = useTranslations("Cell");
    return(
      <Cell 
        cellClassName={cn(
          "relative flex flex-col items-center justify-center aspect-square p-1 sm:p-2 max-md:group-data-[size=9]/card:p-0.5 rounded-lg border shadow-sm text-center transition-all duration-300",
          "bg-card hover:bg-secondary/50",                      // By default PENDING color
          "bg-primary text-primary-foreground cursor-default"   // isJoker
        )}
        isDisabled={true}
        onClick={() => {}}>
        {/* On a 9x9 card on mobile the cell only has room for the icon (spec 20) */}
        <Star className="h-5 w-5 sm:h-8 sm:w-8 sm:mb-1 max-md:group-data-[size=9]/card:h-4 max-md:group-data-[size=9]/card:w-4 max-md:group-data-[size=9]/card:mb-0" />
        <p className={cn("text-[10px] sm:text-xs md:text-sm font-medium max-md:group-data-[size=9]/card:sr-only",
            "text-card-foreground",
            "text-primary-foreground"   // isJoker
          )}>
          {t("joker")}
        </p>
      </Cell>
    )
}