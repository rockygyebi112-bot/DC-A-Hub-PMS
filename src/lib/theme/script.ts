/**
 * Inline blocking script injected into <head> by the root server layout.
 *
 * Sets the initial `light` / `dark` class on <html> before the page paints so
 * users on system dark mode don't see a flash of light theme. This replaces
 * the equivalent script that next-themes used to render from inside its
 * (client) ThemeProvider — React 19 warns about scripts in client components
 * because they don't execute on client re-renders. Rendering it server-side
 * in <head> sidesteps the warning entirely.
 *
 * The body mirrors what `ThemeProvider` writes when the user toggles, so
 * there's no flicker between the pre-paint state and React hydration.
 */
export const THEME_STORAGE_KEY = "theme";

export const themeScript = `(function(){try{var s=localStorage.getItem('${THEME_STORAGE_KEY}'),t=s||'system',r=t==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t,c=document.documentElement.classList;c.remove('light','dark');c.add(r);document.documentElement.style.colorScheme=r;}catch(e){}})();`;
