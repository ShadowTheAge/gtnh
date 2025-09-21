using System.IO.Compression;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Source.Data;

namespace export;

public class OldRecipesGenerator
{
    private static Span<int> ReadSlice(Span<int> data, int pointer)
    {
        var target = data[pointer];
        var length = data[target];
        return data.Slice(target + 1, length);
    }

    private static string ReadString(Span<byte> data, Span<int> intData, int pointer)
    {
        var target = intData[pointer];
        var length = intData[target];
        var slice = data.Slice((target + 1) * 4, length);
        return Encoding.UTF8.GetString(slice);
    }
    
    private static void AppendHash<T>(IncrementalHash hash1, IncrementalHash hash2, RecipeInput<T>[] inputs) where T:GoodsOrDict
    {
        foreach (var input in inputs)
        {
            if (input.amount > 0)
            {
                var encodedId = Encoding.UTF8.GetBytes(input.goods.id);
                hash1.AppendData(encodedId);
                hash2.AppendData(encodedId);
                hash1.AppendData(BitConverter.GetBytes(input.amount));
            }
        }
    }
    
    private static void AppendHash<T>(IncrementalHash hash1, IncrementalHash hash2, RecipeProduct<T>[] inputs) where T:Goods
    {
        foreach (var input in inputs)
        {
            var encodedId = Encoding.UTF8.GetBytes(input.goods.id);
            hash1.AppendData(encodedId);
            hash2.AppendData(encodedId);
            hash1.AppendData(BitConverter.GetBytes(input.amount));
        }
    }
    
    public static void PopulateOldRecipes(Repository repository, string oldDataBin)
    {
        Console.WriteLine("Calculating recipe remaps...");
        using var fs = File.OpenRead(oldDataBin);
        using var unpacked = new MemoryStream();
        using var zip = new GZipStream(fs, CompressionMode.Decompress);
        zip.CopyTo(unpacked);
        var dataBin = new Span<byte>(unpacked.GetBuffer(), 0, (int)unpacked.Length);
        var intBuffer = MemoryMarshal.Cast<byte, int>(dataBin);
        var allRecipes = ReadSlice(intBuffer, 5);
        var dataVersion = intBuffer[0];

        var recipesById = new Dictionary<string, Recipe>();
        var recipesByHash = new Dictionary<string, Recipe>();
        foreach (var recipe in repository.recipes)
        {
            // Calculate hash of the recipe two ways: The first by recipe inputs, outputs and amounts, and the second only by recipe inputs and outputs.
            // Match old recipes to new ones by the first one or by the second one as a fallback
            recipesById[recipe.id] = recipe;
            using var hash1 = IncrementalHash.CreateHash(HashAlgorithmName.MD5);
            using var hash2 = IncrementalHash.CreateHash(HashAlgorithmName.MD5);
            var recipeTypeName = Encoding.UTF8.GetBytes(recipe.recipeType.name);
            hash1.AppendData(recipeTypeName);
            hash2.AppendData(recipeTypeName);
            AppendHash(hash1, hash2, recipe.itemInputs);
            AppendHash(hash1, hash2, recipe.oreDictInputs);
            AppendHash(hash1, hash2, recipe.fluidInputs);
            AppendHash(hash1, hash2, recipe.itemOutputs);
            AppendHash(hash1, hash2, recipe.fluidOutputs);
            recipesByHash[Convert.ToBase64String(hash1.GetCurrentHash())] = recipe;
            recipesByHash[Convert.ToBase64String(hash2.GetCurrentHash())] = recipe;
        }

        var missingRecipes = 0;
        var newRemaps = 0;
        var remappedRecipes = new Dictionary<string, Recipe>();
        foreach (var recipe in allRecipes)
        {
            var id = ReadString(dataBin, intBuffer, recipe + 4);
            if (recipesById.ContainsKey(id))
                continue;

            var recipeTypePtr = intBuffer[recipe + 6];
            var recipeIoList = ReadSlice(intBuffer, recipe + 5);

            using var hash1 = IncrementalHash.CreateHash(HashAlgorithmName.MD5);
            using var hash2 = IncrementalHash.CreateHash(HashAlgorithmName.MD5);
            var recipeTypeName = Encoding.UTF8.GetBytes(ReadString(dataBin, intBuffer, recipeTypePtr));
            hash1.AppendData(recipeTypeName);
            hash2.AppendData(recipeTypeName);
            for (var i = 0; i < recipeIoList.Length; i+=5)
            {
                var type = recipeIoList[i];
                var goods = recipeIoList[i + 1];
                var amount = recipeIoList[i + 3];

                var goodsId = Encoding.UTF8.GetBytes(ReadString(dataBin, intBuffer, goods + 4));
                if (amount > 0 || type >= 3)
                {
                    hash1.AppendData(goodsId);
                    hash2.AppendData(goodsId);
                    hash1.AppendData(BitConverter.GetBytes(amount));
                }
            }
            
            if (recipesByHash.TryGetValue(Convert.ToBase64String(hash1.GetCurrentHash()), out var existingRecipe) 
                || recipesByHash.TryGetValue(Convert.ToBase64String(hash2.GetCurrentHash()), out existingRecipe))
            {
                remappedRecipes[id] = existingRecipe;
                repository.remaps.Add(new RecipeRemap {from = id, to = existingRecipe});
                newRemaps++;
            } 
            else
            {
                missingRecipes++;
            }
        }

        var oldRemaps = 0;
        if (dataVersion >= 4)
        {
            var oldRemap = ReadSlice(intBuffer, 7);
            foreach (var remap in oldRemap)
            {
                var idFrom = ReadString(dataBin, intBuffer, intBuffer[remap]);
                var idTo = ReadString(dataBin, intBuffer, intBuffer[remap+1] + 4);

                var recipeTo = recipesById.GetValueOrDefault(idTo) ?? remappedRecipes.GetValueOrDefault(idTo);
                if (recipeTo == null)
                    continue;
                remappedRecipes[idFrom] = recipeTo;
                repository.remaps.Add(new RecipeRemap {from = idFrom, to = recipeTo});
                oldRemaps++;
            }
        }
        
        Console.WriteLine("Missing recipes: "+missingRecipes+", Remapped recipes: "+newRemaps+", Old remaps: "+oldRemaps);
    }
}