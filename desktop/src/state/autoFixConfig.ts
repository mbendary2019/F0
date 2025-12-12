// desktop/src/state/autoFixConfig.ts
// Phase 127.3: Auto-Fix Configuration

/**
 * Auto-Fix can run:
 * 1) After Background Scan - if health score is below threshold
 * 2) On Save - for style/lint cleanup (optional)
 */

/** Enable auto-fix after background scan (when health score is low) */
export const AUTO_FIX_AFTER_BG_SCAN_ENABLED = true;

/** Health score threshold - auto-fix runs if score is below this */
export const AUTO_FIX_SAFE_MIX_THRESHOLD_SCORE = 60;

/** Max files to auto-fix in one run */
export const AUTO_FIX_SAFE_MIX_MAX_FILES = 25;

/** Profile to use for auto-fix after background scan */
export const AUTO_FIX_BG_SCAN_PROFILE = 'safe_mix';

/** Enable auto-fix on file save (style cleanup) */
export const AUTO_FIX_ON_SAVE_ENABLED = false;

/** Profile to use for on-save auto-fix */
export const AUTO_FIX_ON_SAVE_PROFILE = 'style_only';

/** File extensions that support on-save auto-fix */
export const AUTO_FIX_ON_SAVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx'];
