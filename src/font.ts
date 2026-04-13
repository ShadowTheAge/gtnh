import type { GameDataLocale } from "./gameDataLocale.js";

const zhSecondaryFontStack = `var(--font-ui-secondary-zh)`;
const latinSecondaryFallback = `var(--font-ui-secondary-latin)`;

type FontFormatConfig = {
    uiSizePx?: number;
    uiLineHeightPx?: number;
    controlSizePx?: number;
    controlLineHeightPx?: number;
    inputLineHeightPx?: number;
    smallSizePx?: number;
    smallLineHeightPx?: number;
    smallWordSpacingPx?: number;
};

type FontLocaleProfile = {
    secondaryFontStack?: string;
    systemFontCandidates?: string[];
    format?: FontFormatConfig;
};

const defaultFontFormat: Required<FontFormatConfig> = {
    uiSizePx: 16,
    uiLineHeightPx: 22,
    controlSizePx: 16,
    controlLineHeightPx: 22,
    inputLineHeightPx: 16,
    smallSizePx: 8,
    smallLineHeightPx: 8,
    smallWordSpacingPx: 1,
};

const fontProfiles: Record<string, FontLocaleProfile> = {
    default: {},
    en: {},
    "zh-cn": {
        secondaryFontStack: `"MiSans", ${zhSecondaryFontStack}`,
        format: {
            uiSizePx: 18,
            uiLineHeightPx: 24,
            controlSizePx: 18,
            controlLineHeightPx: 24,
            inputLineHeightPx: 18,
            smallSizePx: 9,
            smallLineHeightPx: 9,
            smallWordSpacingPx: 1,
        },
    },
    ja: {
        systemFontCandidates: ["Yu Gothic UI", "Meiryo", "Noto Sans JP"],
    },
    ko: {
        systemFontCandidates: ["Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR"],
    },
    ar: {
        systemFontCandidates: ["Segoe UI", "Tahoma", "Noto Naskh Arabic"],
    },
    ru: {
        systemFontCandidates: ["Segoe UI", "Arial", "Noto Sans"],
    },
    uk: {
        systemFontCandidates: ["Segoe UI", "Arial", "Noto Sans"],
    },
};

function normalizeLocaleKey(locale: string): string {
    return locale.toLowerCase();
}

function resolveLocaleProfile(locale: string): FontLocaleProfile {
    const normalized = normalizeLocaleKey(locale);
    if (fontProfiles[normalized]) {
        return fontProfiles[normalized];
    }

    const prefix = normalized.split("-")[0];
    if (fontProfiles[prefix]) {
        return fontProfiles[prefix];
    }

    return fontProfiles.default;
}

function resolveFontFormat(locale: string): Required<FontFormatConfig> {
    const profileFormat = resolveLocaleProfile(locale).format ?? {};
    return {
        ...defaultFontFormat,
        ...profileFormat,
    };
}

function browserDefaultLanguageFontCandidates(): string[] {
    const language = normalizeLocaleKey(navigator.language ?? "en");
    const profile = resolveLocaleProfile(language);
    return profile.systemFontCandidates ?? ["Segoe UI", "Helvetica Neue", "Arial", "Noto Sans", "Roboto", "Ubuntu"];
}

function pickAvailableSystemFont(fontCandidates: string[]): string | null {
    if (!document.fonts?.check) {
        return null;
    }

    for (const candidate of fontCandidates) {
        if (document.fonts.check(`16px \"${candidate}\"`)) {
            return candidate;
        }
    }

    return null;
}

function applyFontFormat(locale: string): void {
    const rootStyle = document.documentElement.style;
    const format = resolveFontFormat(locale);
    rootStyle.setProperty("--font-ui-size", `${format.uiSizePx}px`);
    rootStyle.setProperty("--font-ui-line-height", `${format.uiLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-control-size", `${format.controlSizePx}px`);
    rootStyle.setProperty("--font-ui-control-line-height", `${format.controlLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-input-line-height", `${format.inputLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-small-size", `${format.smallSizePx}px`);
    rootStyle.setProperty("--font-ui-small-line-height", `${format.smallLineHeightPx}px`);
    rootStyle.setProperty("--font-ui-small-word-spacing", `${format.smallWordSpacingPx}px`);
}

export function applyDatabaseLocaleFont(databaseLocale: GameDataLocale): void {
    const rootStyle = document.documentElement.style;
    document.documentElement.dataset.dbLocale = databaseLocale;
    applyFontFormat(databaseLocale);

    if (databaseLocale === "zh-CN") {
        rootStyle.setProperty("--font-ui-secondary", resolveLocaleProfile(databaseLocale).secondaryFontStack ?? zhSecondaryFontStack);
        return;
    }

    const selected = pickAvailableSystemFont(browserDefaultLanguageFontCandidates());
    if (selected) {
        rootStyle.setProperty("--font-ui-secondary", `\"${selected}\", ${latinSecondaryFallback}`);
        return;
    }

    rootStyle.setProperty("--font-ui-secondary", latinSecondaryFallback);
}