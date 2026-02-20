const MOBILE_BREAKPOINT = 960;
const TABLET_BREAKPOINT = 1280;

export interface LayoutMode {
  isMobile: boolean;
  columns: number;
}

export function dashboardLayoutForWidth(width: number): LayoutMode {
  if (width < MOBILE_BREAKPOINT) {
    return { isMobile: true, columns: 1 };
  }

  if (width < TABLET_BREAKPOINT) {
    return { isMobile: false, columns: 2 };
  }

  return { isMobile: false, columns: 4 };
}

export function agentProfileLayoutForWidth(width: number): LayoutMode {
  if (width < MOBILE_BREAKPOINT) {
    return { isMobile: true, columns: 1 };
  }

  return { isMobile: false, columns: 2 };
}

export function networkLayoutForWidth(width: number): LayoutMode {
  if (width < MOBILE_BREAKPOINT) {
    return { isMobile: true, columns: 1 };
  }

  if (width < TABLET_BREAKPOINT) {
    return { isMobile: false, columns: 2 };
  }

  return { isMobile: false, columns: 3 };
}
