// Pages du pager principal, dans l'ordre d'affichage, comme Snap :
// messages à gauche de la caméra ; stories, puis découvertes à droite.
// « Match » (adultes seulement) vient après les stories : il n'est plus la première chose qu'on voit,
// et la caméra garde la même position (index 1) pour tout le monde.
export type PageName = "Matching" | "Friends" | "Camera" | "StoriesFeed" | "Profile";

export function pagesFor(showMatch: boolean): PageName[] {
  return showMatch
    ? ["Friends", "Camera", "StoriesFeed", "Matching", "Profile"]
    : ["Friends", "Camera", "StoriesFeed", "Profile"];
}

export const CAMERA_PAGE_INDEX = 1;
