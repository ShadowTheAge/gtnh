const loading = document.getElementById("loading")!;
try {
    // Load the atlas image
    const atlas = new Image();
    atlas.src = "./data/atlas.webp";

    // Load repository and data in parallel
    const [repositoryModule, localeModule, response, localeResponse] = await Promise.all([
        import("./repository.js"),
        import("./locale.js"),
        fetch(import.meta.resolve("./data/data.bin")),
        fetch(import.meta.resolve("./data/ru_RU.json"))
    ]);
    const stream = response.body!.pipeThrough(new DecompressionStream("gzip"));
    const buffer = await new Response(stream).arrayBuffer();
    repositoryModule.Repository.load(buffer);
    console.log("Repository loaded", repositoryModule.Repository.current);

    await localeModule.LoadLocale(localeResponse);


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