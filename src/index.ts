import { applyDatabaseLocaleFont } from "./font.js";
import type { GameDataLocale } from "./gameDataLocale.js";

const loading = document.getElementById("loading")!;
try {
    // Load the atlas image
    const atlas = new Image();
    atlas.src = "./data/atlas.webp";
    
    const gameDataLocale: GameDataLocale = "zh-CN";
    applyDatabaseLocaleFont(gameDataLocale);

    // Load repository and data in parallel
    const [repositoryModule, response] = await Promise.all([
        import("./repository.js"),
        fetch(import.meta.resolve("./data/data.bin"))
    ]);
    const stream = response.body!.pipeThrough(new DecompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    repositoryModule.Repository.load(buffer);
    console.log("Repository loaded", repositoryModule.Repository.current);

    // Then load other modules
    await Promise.all([
        import("./itemIcon.js"),
        import("./tooltip.js"),
        import("./nei.js"),
        import("./menu.js"),
        import("./recipeList.js")
    ]);
    let page = await import("./page.js");
    page.UpdateProject();
    loading.remove();
} catch (error:any) {
    loading.innerHTML = "An error occurred on loading:<br>" + error.message;
    console.error(error);
}

export {};