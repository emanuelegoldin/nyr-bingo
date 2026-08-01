/**
 * Compound Resolution Repository
 * Re-exports compound resolution functions from the unified resolution repository.
 * Kept for backward compatibility with existing API routes.
 */

export {
  createCompoundResolution, deleteCompoundResolution, getCompoundResolutionById, getCompoundResolutionsByUser, toggleCompoundSubtask, updateCompoundResolution
} from './resolution-repository';
