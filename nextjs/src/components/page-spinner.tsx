import { Loader2 } from 'lucide-react';

/**
 * Centered full-width loading spinner used as a page-level loading state.
 *
 * @returns The spinner element.
 */
export function PageSpinner() {
  return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}
