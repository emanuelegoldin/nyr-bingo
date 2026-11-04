import { cn } from "@/lib/utils"
import { Star } from "lucide-react"
import { Cell } from "./cell"

export const JokerCell = () => {
    return(
      <Cell 
        cellClassName={cn(
          "relative flex flex-col items-center justify-center aspect-square p-1 sm:p-2 rounded-lg border shadow-sm text-center transition-all duration-300",
          "bg-card hover:bg-secondary/50",                      // By default PENDING color
          "bg-primary text-primary-foreground cursor-default"   // isJoker
        )}
        isDisabled={true}
        onClick={() => {}}>
        <Star className="h-5 w-5 sm:h-8 sm:w-8 sm:mb-1" />
        <p className={cn("text-[10px] sm:text-xs md:text-sm font-medium",
            "text-card-foreground",
            "text-primary-foreground"   // isJoker
          )}>
          Joker
        </p>
      </Cell>
    )
}