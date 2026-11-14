// Your rating as the opponents see it (Maia-3's OppoElo). Loaded at start-up and updated after
// every rated game; kept in memory so the bots don't wait for storage on every move.
let rating = 1200;
export const setPlayerRating = (r: number) => void (rating = Math.max(100, Math.min(3000, Math.round(r))));
export const getPlayerRating = () => rating;
