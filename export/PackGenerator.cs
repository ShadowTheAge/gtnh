using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using export;
using Source.Data;

namespace Source
{
    public static class PackGenerator
    {
        public static Repository Generate(string sourcePath, string targetPath, string minecraftPath, bool skipIcons = false, string previousDataBin = null)
        {
            var dbParser = new DatabaseParser();
            dbParser.Parse(Path.Combine(sourcePath, "nesql-db.script"));
            var locale = new Locale();
            if (minecraftPath != null)
                locale.LoadFromFolder(minecraftPath);

            var iconList = new List<string>();
            var repository = PackConverter.Convert(dbParser, iconList);
            
            PackPreProcessor.PreProcessPack(repository);
            HardcodeFixes.Fix(repository);
            FontCharactersFixer.FixFontCharacters(repository);
            RecipeConflictsCalculator.CalculateRecipeConflicts(repository);
            
            if (previousDataBin != null)
            {
                OldRecipesGenerator.PopulateOldRecipes(repository, previousDataBin);
            }

            Console.WriteLine("Exporting locales...");
            var localeBuilder = new LocalePackBuilder();
            var english = localeBuilder.BuildDefault(repository, locale.english.code);
            var locales = new List<LocalePack> { english };

            foreach (var language in locale.languages)
            {
                if (language == locale.english) continue;
                var lang = locale.TranslateLocale(english, language);
                locales.Add(lang);
            }

            var options = new JsonSerializerOptions { WriteIndented = true, Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping};
            foreach (var pack in locales)
            {
                using var target = File.Create(Path.Combine(targetPath, pack.code + ".json"));
                JsonSerializer.Serialize(target, pack, options);
            }
            
            Console.WriteLine("Exporting data.bin...");
            var mmap = new MemoryMappedPackConverter(repository);
            var compiledBytes = mmap.Compile();
            File.WriteAllBytes(Path.Combine(targetPath, "data.bin"), compiledBytes);
            
            if (!skipIcons)
            {
                using var builder = new AtlasBuilder(Path.Combine(sourcePath, "image.zip"), Path.Combine(targetPath, "atlas.webp"));
                builder.BuildAtlas(iconList);
            }
            
            return repository;
        }
    }
}