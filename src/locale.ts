import { SearchQuery } from "./searchQuery.js";

export class LocalePack {
    code!: string;
    lines!: string[];
    names!: { [key: string]: number };
    tooltips!: { [key: string]: number[] };
}

let currentLocale: LocalePack;

export function LoadLocale(response: Response): Promise<void> {
    return response.json().then((data: LocalePack) => {
        currentLocale = data;
    });
}

export function GetObjectName(id: string): string {
    const index = currentLocale.names[id];
    if (index === undefined) return id;
    return currentLocale.lines[index];
}

export function GetObjectTooltip(id: string): string {
    const indices = currentLocale.tooltips[id];
    if (indices === undefined) return '';
    return indices.map(i => currentLocale.lines[i]).join('\n');
}

export function SearchLocale(query: SearchQuery): string[] {
    const matchingLines = new Set<number>();
    for (let i = 0; i < currentLocale.lines.length; i++) {
        if (query.Match(currentLocale.lines[i]))
            matchingLines.add(i);
    }

    const result = new Set<string>();

    for (const [id, index] of Object.entries(currentLocale.names)) {
        if (matchingLines.has(index))
            result.add(id);
    }

    for (const [id, indices] of Object.entries(currentLocale.tooltips)) {
        if (indices.some(i => matchingLines.has(i)))
            result.add(id);
    }

    return [...result];
}