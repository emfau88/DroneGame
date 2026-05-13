/**
 * StarRating — animated star reveal component. Scaffold only for v0.1.
 * Full animated impl in v0.6.
 */
export class StarRating {
  constructor() {}

  /** Returns 1–3 based on score ratio and secondary objective. */
  calculate(blueScore, redScore, threshold, secondaryMet, noCasualties) {
    if (blueScore < redScore * threshold) return 0; // loss
    let stars = 1;
    if (secondaryMet) stars = 2;
    if (secondaryMet && noCasualties) stars = 3;
    return stars;
  }
}
