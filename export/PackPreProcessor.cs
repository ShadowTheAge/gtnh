using System.Text;
using System.Text.RegularExpressions;
using export;
using Source.Data;

namespace Source
{
    public static class PackPreProcessor
    {
        public static void PreProcessPack(Repository repository)
        {
            Console.WriteLine("Adding fluid tooltips...");
            ProcessFluidTooltips(repository);
            Console.WriteLine("Processing aspects...");
            ProcessAspects(repository);
            Console.WriteLine("Processing tooltips...");
            ProcessToolTips(repository.items);
            ProcessToolTips(repository.fluids);
            Console.WriteLine("Calculating index bits");
            CalculateIndexBits(repository);
            Console.WriteLine("Calculating production/consumption");
            CalculateProductionConsumption(repository);
            Console.WriteLine("Calculating containers");
            CalculateContainers(repository);
            Console.WriteLine("Calculating machines");
            CalculateMachines(repository);
            Truncate(repository);
        }

        private static void ProcessFluidTooltips(Repository repository)
        {
            foreach (var item in repository.items)
            {
                if (item.container != null && item.container.empty.name == "Empty Cell" && item.tooltipParts.Count > 0)
                    item.container.fluid.tooltipParts = item.tooltipParts;
            }
        }

        private static void CalculateContainers(Repository repository)
        {
            for (var itemIndex = 0; itemIndex < repository.items.Count; itemIndex++)
            {
                var item = repository.items[itemIndex];
                if (item.container != null)
                {
                    AddToArrayBuffer(ref item.container.fluid.containers, itemIndex);
                }
            }
        }

        private static bool GetSingleBlockVoltageTier(Item item, out int tier)
        {
            tier = 0;
            var voltageTooltip = item.tooltipParts.FirstOrDefault(x => x.Contains("Voltage IN"));
            if (voltageTooltip == null)
                return false;
            
            var cleanedTooltip = Regex.Replace(voltageTooltip, "§.", "");
            
            foreach (var vtier in VoltageTiers.voltageTiers)
            {
                if (cleanedTooltip.Contains("(" + vtier + ")"))
                    return true;
                tier++;
            }
            return false;
        }
        

        private static void CalculateMachines(Repository repository)
        {
            var categoryMachines = new Dictionary<string, (RecipeType, List<Item>)>();
            foreach (var recipeType in repository.recipeTypes)
            {
                categoryMachines[recipeType.name] = (recipeType, new List<Item>());
            }

            foreach (var (_, (type, item)) in categoryMachines)
            {
                Item fallbackCrafter = null;
                foreach (var crafter in type.crafters)
                {
                    fallbackCrafter = crafter;
                    if (!item.Contains(crafter))
                    {
                        if (!crafter.tooltipParts.Any(x => x.Contains("DEPRECATED")))
                            item.Add(crafter);
                    }
                }

                var sb = new Item[20];
                var mb = new List<Item>();

                foreach (var i in item)
                {
                    if (GetSingleBlockVoltageTier(i, out var tier))
                        sb[tier] = i;
                    else
                        mb.Add(i);
                }

                var maxTier = Array.FindLastIndex(sb, x => x != null);
                if (maxTier > -1)
                    type.singleblocks.AddRange(sb.Take(maxTier+1));
                type.multiblocks.AddRange(mb);
                type.defaultCrafter = type.singleblocks.Count > 0 ? type.singleblocks.First(x => x != null) : type.multiblocks.FirstOrDefault(fallbackCrafter);
            }
        }

        private static void ProcessAspects(Repository repository)
        {
            var aspects = repository.items.Where(x => x.damage == 0 && x.unlocalizedName == "item.aspect").ToDictionary(x => x.name);
            var crafter = repository.items.First(x => x.name == "Alchemical Furnace");
            var recipeType = new RecipeType
            {
                shapeless = true, itemInputs = new RecipeDimensions(1, 1), itemOutputs = new RecipeDimensions(5, 2), category = "thaumcraft", name = "Item aspects",
                crafters = new List<Item> {crafter}, defaultCrafter = crafter, 
            };
            repository.recipeTypes.Add(recipeType);
            
            foreach (var item in repository.items)
            {
                if (item.aspects.Count == 0)
                    continue;
                var recipe = new Recipe
                {
                    id = "r:asp:" + item.id, itemInputs = new RecipeInput<Item>[] { new() { goods = item, amount = 1, slot = 0 } },
                    itemOutputs = item.aspects.Select((x, id) => new RecipeProduct<Item> { goods = aspects[x.name], probability = 1, slot = id, amount = x.amount}).ToArray(),
                    recipeType = recipeType, fluidInputs = Array.Empty<RecipeInput<Fluid>>(), fluidOutputs = Array.Empty<RecipeProduct<Fluid>>(), oreDictInputs = Array.Empty<RecipeInput<OreDict>>()
                };
                repository.recipes.Add(recipe);
            }
        }

        private static void ProcessToolTips<T>(List<T> goods) where T:Goods
        {
            foreach (var item in goods)
            {
                var parts = item.tooltipParts;
                if (parts.Count > 0 && parts[0].StartsWith(item.name))
                    parts.RemoveAt(0);
                for (var i = parts.Count - 1 - 1; i >= 0; i--)
                {
                    var part = parts[i];
                    var remove = (part.Contains("press", StringComparison.OrdinalIgnoreCase) || part.Contains("hold", StringComparison.OrdinalIgnoreCase)) &&
                                 (part.Contains("ctrl", StringComparison.OrdinalIgnoreCase) || part.Contains("shift", StringComparison.OrdinalIgnoreCase) ||
                                  part.Contains("control", StringComparison.OrdinalIgnoreCase));
                    if (remove)
                        parts.RemoveAt(i);
                }

                while (parts.Count > 0 && parts[0] == "")
                    parts.RemoveAt(0);
            }
        }

        private static void AddToArrayBuffer(ref int[] arr, int id)
        {
            if (arr.Length == 0)
            {
                arr = new []{ id, 0, 0, 1 };
                return;
            }
            var l = arr[^1];
            if (arr[l - 1] == id)
                return;
            arr[l++] = id;
            if (l == arr.Length)
                Array.Resize(ref arr, arr.Length * 2);
            arr[^1] = l;
        }

        private static void TruncateArray(ref int[] arr)
        {
            if (arr.Length > 0)
                Array.Resize(ref arr, arr[^1]);
        }

        private static void CalculateProductionConsumption(Repository repository)
        {
            for (var recipeIndex = 0; recipeIndex < repository.recipes.Count; recipeIndex++)
            {
                var recipe = repository.recipes[recipeIndex];
                foreach (var production in recipe.itemOutputs)
                    AddToArrayBuffer(ref production.goods.production, recipeIndex);
                foreach (var production in recipe.itemInputs)
                    AddToArrayBuffer(ref production.goods.consumption, recipeIndex);
                foreach (var production in recipe.fluidOutputs)
                    AddToArrayBuffer(ref production.goods.production, recipeIndex);
                foreach (var production in recipe.fluidInputs)
                    AddToArrayBuffer(ref production.goods.consumption, recipeIndex);
                foreach (var oreDict in recipe.oreDictInputs)
                    foreach (var item in oreDict.goods.variants)
                        AddToArrayBuffer(ref item.consumption, recipeIndex);
            }
        }

        private static void Truncate(Repository repository)
        {
            foreach (var item in repository.items)
            {
                TruncateArray(ref item.production);
                TruncateArray(ref item.consumption);
            }
            
            foreach (var fluid in repository.fluids)
            {
                TruncateArray(ref fluid.production);
                TruncateArray(ref fluid.consumption);
                TruncateArray(ref fluid.containers);
            }
        }
        
        private static void CalculateIndexBits(Repository repository)
        {
            foreach (var oreDict in repository.oreDicts)
            {
                foreach (var variant in oreDict.variants)
                    oreDict.indexBits |= SearchIndex.GetIndexBits(variant.name);
            }

            foreach (var item in repository.items)
                item.indexBits = SearchIndex.GetIndexBits(item.name) | SearchIndex.GetIndexBits(item.tooltipParts);
            
            foreach (var fluid in repository.fluids)
                fluid.indexBits = SearchIndex.GetIndexBits(fluid.name) | SearchIndex.GetIndexBits(fluid.tooltipParts);

            foreach (var recipe in repository.recipes)
            {
                foreach (var input in recipe.fluidInputs)
                    recipe.indexBits |= SearchIndex.GetIndexBits(input.goods.name);
                foreach (var input in recipe.itemInputs)
                    recipe.indexBits |= SearchIndex.GetIndexBits(input.goods.name);
                foreach (var input in recipe.oreDictInputs)
                    recipe.indexBits |= input.goods.indexBits;
                foreach (var output in recipe.fluidOutputs)
                    recipe.indexBits |= SearchIndex.GetIndexBits(output.goods.name);
                foreach (var output in recipe.itemOutputs)
                    recipe.indexBits |= SearchIndex.GetIndexBits(output.goods.name);
            }
        }
    }
}