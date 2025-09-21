using System.Collections;
using System.IO.Compression;
using System.Runtime.CompilerServices;
using System.Runtime.InteropServices;
using System.Text;
using Source.Data;
using CompressionLevel = System.IO.Compression.CompressionLevel;

namespace Source
{
    public class MemoryMappedPackConverter
    {
        private readonly Repository repository;
        private readonly Dictionary<object, int> objects = new Dictionary<object, int>();

        private readonly List<(object, int)> writePositions = new List<(object, int)>();
        private readonly Stack<object> objectsToWrite = new Stack<object>();

        private readonly List<int> rawData = new List<int>();
        private readonly string[] serviceItems = new[] { "Quest Book", "Anvil" };
        
        private const int DATA_VERSION = 4;

        public MemoryMappedPackConverter(Repository repository)
        {
            this.repository = repository;
            WriteInt(DATA_VERSION);
            WriteObjectRef(repository.items);
            WriteObjectRef(repository.fluids);
            WriteObjectRef(repository.oreDicts);
            WriteObjectRef(repository.recipeTypes);
            WriteObjectRef(repository.recipes);
            WriteObjectRef(Array.ConvertAll(serviceItems, x => this.repository.items.First(y => y.name == x)));
            WriteObjectRef(repository.remaps);
        }

        private void WriteInt(int i)
        {
            rawData.Add(i);
        }
        
        private void WriteStringRef(string s)
        {
            rawData.Add(-1);
            if (string.IsNullOrEmpty(s))
                return;
            writePositions.Add((s, rawData.Count - 1));
        }

        private void WriteObjectRef(object o)
        {
            rawData.Add(-1);
            if (o == null)
                return;
            if (objects.TryAdd(o, 0))
                objectsToWrite.Push(o);
            writePositions.Add((o, rawData.Count - 1));
        }

        private void WriteObjectVerbatim(object o)
        {
            objects[o] = rawData.Count;

            switch (o)
            {
                case Item item: Write(item); return;
                case Fluid fluid: Write(fluid); return;
                case RecipeType recipeType: Write(recipeType); return;
                case Recipe recipe: Write(recipe); return;
                case OreDict oreDict: Write(oreDict); return;
                case GtRecipeInfo gtRecipe: Write(gtRecipe); return;
                case FluidContainer container: Write(container); return;
                case int[] intArr: Write(intArr); return;
                case IList genericList: Write(genericList); return;
                case RecipeRemap remap: Write(remap); return;
                case int i: WriteInt(i); return;
                case string s: WriteStringRef(s); return;
                default: throw new InvalidOperationException("Unexpected type: "+o.GetType());
            }
        }

        private void Write(IList genericList)
        {
            WriteInt(genericList.Count);
            foreach (var elem in genericList)
                if (elem is int i)
                    WriteInt(i); 
                else WriteObjectRef(elem);
        }

        private void Write(int[] elements)
        {
            WriteInt(elements.Length);
            foreach (var elem in elements)
                WriteInt(elem);
        }

        private void Write(GtRecipeInfo recipeType)
        {
            WriteInt(recipeType.voltage);
            WriteInt(recipeType.durationTicks);
            WriteInt(recipeType.amperage);
            WriteInt(recipeType.voltageTier);
            WriteInt((recipeType.cleanRoom ? 1 : 0) + (recipeType.lowGravity ? 2 : 0));
            WriteStringRef(recipeType.additionalInfo);
            WriteInt(recipeType.circuitConflicts);
            WriteInt(recipeType.specialValue);
        }

        private void WriteIndexBits(IndexableObject obj)
        {
            Span<byte> buf = stackalloc byte[16];
            Unsafe.WriteUnaligned(ref buf[0], obj.indexBits);
            WriteInt(Unsafe.ReadUnaligned<int>(ref buf[0]));
            WriteInt(Unsafe.ReadUnaligned<int>(ref buf[4]));
            WriteInt(Unsafe.ReadUnaligned<int>(ref buf[8]));
            WriteInt(Unsafe.ReadUnaligned<int>(ref buf[12]));
            WriteStringRef(obj.id);
        }

        private void Write(OreDict dict)
        {
            WriteIndexBits(dict);
            WriteObjectRef(dict.variants);
        }
        
        private void Write(RecipeRemap remap)
        {
            WriteStringRef(remap.from);
            WriteObjectRef(remap.to);
        }

        private object[] PackRecipeInOut(Recipe recipe)
        {
            var totalIO = recipe.fluidInputs.Length + recipe.fluidOutputs.Length + recipe.itemInputs.Length + recipe.itemOutputs.Length + recipe.oreDictInputs.Length;
            var arr = new object[totalIO * 5];
            var index = 0;
            foreach (var input in recipe.itemInputs)
                WriteRecipeInput(arr, ref index, input);
            foreach (var input in recipe.oreDictInputs)
                WriteRecipeInput(arr, ref index, input);
            foreach (var input in recipe.fluidInputs)
                WriteRecipeInput(arr, ref index, input);
            foreach (var output in recipe.itemOutputs)
                WriteRecipeOutput(arr, ref index, output);
            foreach (var output in recipe.fluidOutputs)
                WriteRecipeOutput(arr, ref index, output);
            return arr;
        }

        private void WriteRecipeInput<T>(object[] arr, ref int index, RecipeInput<T> input) where T : GoodsOrDict
        {
            var id = typeof(T) == typeof(Item) ? 0 : typeof(T) == typeof(Fluid) ? 2 : typeof(T) == typeof(OreDict) ? 1 : -1;
            arr[index++] = id;
            arr[index++] = input.goods;
            arr[index++] = input.slot;
            arr[index++] = input.amount;
            arr[index++] = 100;
        }
        
        private void WriteRecipeOutput<T>(object[] arr, ref int index, RecipeProduct<T> input) where T : Goods
        {
            var id = typeof(T) == typeof(Item) ? 3 : typeof(T) == typeof(Fluid) ? 4 : -1;
            arr[index++] = id;
            arr[index++] = input.goods;
            arr[index++] = input.slot;
            arr[index++] = input.amount;
            arr[index++] = (int)Math.Round(input.probability * 100);
        }

        private void Write(Recipe recipe)
        {
            WriteIndexBits(recipe);
            WriteObjectRef(PackRecipeInOut(recipe));
            WriteObjectRef(recipe.recipeType);
            WriteObjectRef(recipe.gtInfo);
        }

        private void Write(RecipeType recipeType)
        {
            WriteStringRef(recipeType.name);
            WriteStringRef(recipeType.category);
            WriteObjectRef(new[]
            {
                recipeType.itemInputs.x, recipeType.itemInputs.y, recipeType.fluidInputs.x, recipeType.fluidInputs.y, 
                recipeType.itemOutputs.x, recipeType.itemOutputs.y, recipeType.fluidOutputs.x, recipeType.fluidOutputs.y
            });
            WriteObjectRef(recipeType.multiblocks);
            WriteInt(recipeType.shapeless ? 1 : 0);
            WriteObjectRef(recipeType.singleblocks);
            WriteObjectRef(recipeType.defaultCrafter);
        }

        private void WriteGoods(Goods goods)
        {
            WriteIndexBits(goods);
            WriteStringRef(MinecraftTextConverter.ToHtml(goods.name));
            WriteStringRef(goods.mod);
            WriteStringRef(goods.internalName);
            WriteInt(goods.numericId);
            WriteInt(goods.iconId);
            WriteStringRef(MinecraftTextConverter.ToHtml(goods.tooltip));
            WriteStringRef(goods.unlocalizedName);
            WriteStringRef(goods.nbt);
            WriteObjectRef(Array.ConvertAll(goods.production, x => repository.recipes[x]).ToArray());
            WriteObjectRef(Array.ConvertAll(goods.consumption, x => repository.recipes[x]).ToArray());
        }
        
        private void Write(Fluid fluid)
        {
            WriteGoods(fluid);
            WriteInt(fluid.isGas ? 1 : 0);
            WriteObjectRef(fluid.containers);
        }

        private void Write(Item item)
        {
            WriteGoods(item);
            WriteInt(item.stackSize);
            WriteInt(item.damage);
            WriteObjectRef(item.container);
        }

        private void Write(FluidContainer container)
        {
            WriteObjectRef(container.fluid);
            WriteInt(container.amount);
            WriteObjectRef(container.empty);
        }

        public byte[] Compile()
        {
            while (objectsToWrite.TryPop(out var o))
                WriteObjectVerbatim(o);
            
            var stringPositions = new Dictionary<string, int>();
            foreach (var (obj, pos) in writePositions)
            {
                if (obj is string s)
                {
                    if (!stringPositions.TryGetValue(s, out var existingPos))
                    {
                        stringPositions[s] = existingPos = rawData.Count;
                        var processedString = s.Trim().Replace("\r", "");
                        var stringBytes = Encoding.UTF8.GetBytes(processedString).AsSpan();
                        rawData.Add(stringBytes.Length);
                        while (stringBytes.Length > 0)
                        {
                            var part = stringBytes.Slice(0, Math.Min(stringBytes.Length, 4));
                            var i = Unsafe.ReadUnaligned<int>(ref MemoryMarshal.GetReference(part));
                            stringBytes = stringBytes.Slice(part.Length);
                            rawData.Add(i);
                        }
                    }
                    rawData[pos] = existingPos;
                }
                else
                {
                    rawData[pos] = objects[obj];
                }
            }

            var resultData = rawData.ToArray();
            var resultDataAsBytes = MemoryMarshal.AsBytes(resultData.AsSpan());
            var finalMemory = new MemoryStream();
            {
                using var zip = new GZipStream(finalMemory, CompressionLevel.Optimal);
                zip.Write(resultDataAsBytes);
                zip.Flush();
            }
            return finalMemory.ToArray();
        }
    }
}