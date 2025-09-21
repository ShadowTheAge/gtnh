using export;
using GT_recipe_parser;
using Source.Data;

namespace Source
{
    public static class PackConverter
    {
        public static readonly TypeSchema<AspectModel> aspect = new ("ASPECT");
        public static readonly TypeSchema<AspectAspectModel> aspectAspect = new ("ASPECT_ASPECT");
        public static readonly TypeSchema<AspectEntryModel> aspectEntry = new ("ASPECT_ENTRY");
        public static readonly TypeSchema<FluidModel> fluid = new ("FLUID");
        public static readonly TypeSchema<FluidBlockModel> fluidBlock = new ("FLUID_BLOCK");
        public static readonly TypeSchema<FluidContainerModel> fluidContainer = new ("FLUID_CONTAINER");
        public static readonly TypeSchema<FluidGroupFluidStacksModel> fluidGroupFluidStacks = new ("FLUID_GROUP_FLUID_STACKS");
        public static readonly TypeSchema<FluidGroupModel> fluidGroup = new ("FLUID_GROUP");
        public static readonly TypeSchema<GregTechRecipeModel> gregTechRecipe = new ("GREG_TECH_RECIPE");
        public static readonly TypeSchema<GregTechRecipeItemModel> gregTechRecipeItem = new ("GREG_TECH_RECIPE_ITEM");
        public static readonly TypeSchema<ItemModel> item = new ("ITEM");
        public static readonly TypeSchema<ItemGroupModel> itemGroup = new ("ITEM_GROUP");
        public static readonly TypeSchema<ItemGroupItemStacksModel> itemGroupItemStacks = new ("ITEM_GROUP_ITEM_STACKS");
        public static readonly TypeSchema<ItemToolClassesModel> itemToolClasses = new ("ITEM_TOOL_CLASSES");
        public static readonly TypeSchema<MobModel> mob = new ("MOB");
        public static readonly TypeSchema<MobInfoModel> mobInfo = new ("MOB_INFO");
        public static readonly TypeSchema<MobInfoDropsModel> mobInfoDrops = new ("MOB_INFO_DROPS");
        public static readonly TypeSchema<MobInfoSpawnInfoModel> mobInfoSpawnInfo = new ("MOB_INFO_SPAWN_INFO");
        public static readonly TypeSchema<OreDictionaryModel> oreDictionary = new ("ORE_DICTIONARY");
        public static readonly TypeSchema<QuestModel> quest = new ("QUEST");
        public static readonly TypeSchema<QuestLineModel> questLine = new ("QUEST_LINE");
        public static readonly TypeSchema<QuestLineQuestModel> questLineQuest = new ("QUEST_LINE_QUEST");
        public static readonly TypeSchema<QuestLineQuestLineEntriesModel> questLineQuestLineEntries = new ("QUEST_LINE_QUEST_LINE_ENTRIES");
        public static readonly TypeSchema<QuestQuestModel> questQuest = new ("QUEST_QUEST");
        public static readonly TypeSchema<QuestRewardModel> questReward = new ("QUEST_REWARD");
        public static readonly TypeSchema<QuestTaskModel> questTask = new ("QUEST_TASK");
        public static readonly TypeSchema<RecipeModel> recipe = new ("RECIPE");
        public static readonly TypeSchema<RecipeFluidGroupModel> recipeFluidGroup = new ("RECIPE_FLUID_GROUP");
        public static readonly TypeSchema<RecipeFluidInputsFluidsModel> recipeFluidInputsFluids = new ("RECIPE_FLUID_INPUTS_FLUIDS");
        public static readonly TypeSchema<RecipeFluidOutputsModel> recipeFluidOutputs = new ("RECIPE_FLUID_OUTPUTS");
        public static readonly TypeSchema<RecipeItemGroupModel> recipeItemGroup = new ("RECIPE_ITEM_GROUP");
        public static readonly TypeSchema<RecipeItemInputsItemsModel> recipeItemInputsItems = new ("RECIPE_ITEM_INPUTS_ITEMS");
        public static readonly TypeSchema<RecipeItemOutputsModel> recipeItemOutputs = new ("RECIPE_ITEM_OUTPUTS");
        public static readonly TypeSchema<RecipeTypeModel> recipeType = new ("RECIPE_TYPE");
        public static readonly TypeSchema<RewardModel> reward = new ("REWARD");
        public static readonly TypeSchema<RewardItemGroupModel> rewardItemGroup = new ("REWARD_ITEM_GROUP");
        public static readonly TypeSchema<TaskModel> task = new ("TASK");
        public static readonly TypeSchema<TaskFluidsModel> taskFluids = new ("TASK_FLUIDS");
        public static readonly TypeSchema<TaskItemGroupModel> taskItemGroup = new ("TASK_ITEM_GROUP");
        public static readonly TypeSchema<RecipeTypeItemModel> recipeTypeItem = new ("RECIPE_TYPE_ITEM");

        public static readonly TypeSchema[] All = 
        {
            aspect, aspectAspect, aspectEntry, fluid, fluidBlock, fluidContainer, fluidGroupFluidStacks, fluidGroup, gregTechRecipe, gregTechRecipeItem, item, itemGroup,
            itemGroupItemStacks, itemToolClasses, mob, mobInfo, mobInfoDrops, mobInfoSpawnInfo, oreDictionary, quest, questLine, questLineQuest, questLineQuestLineEntries,
            questQuest, questReward, questTask, recipe, recipeFluidGroup, recipeFluidInputsFluids, recipeFluidOutputs, recipeItemGroup, recipeItemInputsItems,
            recipeItemOutputs, recipeType, reward, rewardItemGroup, task, taskFluids, taskItemGroup, recipeTypeItem
        };

        public static TypeSchema FindSchema(string name)
        {
            foreach (var schema in All)
            {
                if (schema.tableName == name)
                    return schema;
            }

            return null;
        }

        private class ItemGroupBuilder
        {
            public string iid;
            public string oredict;
            public readonly List<RecipeInput<Item>> variants = new List<RecipeInput<Item>>();

            public Item singleItem;
            public OreDict multiItem;
            public int amount;
            public ItemGroupBuilder baseItemGroup;
            private bool compiled;
            public bool touched;

            public void MarkUsedItems()
            {
                if (!touched || variants.Count == 0)
                    return;
                if (variants.Any(x => x.goods.touched))
                    return;
                variants[0].goods.touched = true;
            }

            public void Compile()
            {
                if (variants.Count == 0 || compiled || !touched)
                    return;
                compiled = true;
                amount = variants[0].amount;
                if (baseItemGroup != this)
                {
                    baseItemGroup.touched = true;
                    baseItemGroup.Compile();
                    singleItem = baseItemGroup.singleItem;
                    multiItem = baseItemGroup.multiItem;
                }
                else
                {
                    variants.RemoveAll(x => !x.goods.touched);
                    if (variants.Count == 1)
                        singleItem = variants[0].goods;
                    else multiItem = new OreDict { id = oredict, variants = variants.Select(x => x.goods).ToArray(), iid = iid };
                }
            }
        }

        private class FluidGroupBuilder
        {
            public RecipeInput<Fluid> fluid;
        }
        
        private class RecipeBuilder
        {
            public Recipe recipe;
            public List<(int slot, ItemGroupBuilder items)> itemInputs = new();
            public List<(int slot, FluidGroupBuilder fluid)> fluidInputs = new();
            public List<RecipeProduct<Item>> itemOutputs = new();
            public List<RecipeProduct<Fluid>> fluidOutputs = new();
            public bool banned;

            private static List<RecipeInput<Item>> bufferItems = new();
            private static List<RecipeInput<Fluid>> bufferFluids = new();
            private static List<RecipeInput<OreDict>> bufferOredict = new();

            public void MarkUsedItems()
            {
                foreach (var output in itemOutputs)
                {
                    if (output.goods == null)
                        banned = true;
                    else output.goods.touched = true;
                }

                foreach (var input in itemInputs)
                {
                    input.items.touched = true;
                }
            }
            
            public void Compile()
            {
                recipe.itemOutputs = itemOutputs.ToArray();
                recipe.fluidOutputs = fluidOutputs.ToArray();
                bufferItems.Clear();
                bufferFluids.Clear();
                bufferOredict.Clear();
                foreach (var input in fluidInputs)
                {
                    var fluid = input.fluid.fluid;
                    fluid.slot = input.slot;
                    bufferFluids.Add(fluid);
                }

                recipe.fluidInputs = bufferFluids.ToArray();
                foreach (var input in itemInputs)
                {
                    if (input.items.variants.Count == 0)
                        banned = true;
                    if (input.items.multiItem != null)
                        bufferOredict.Add(new RecipeInput<OreDict> {goods = input.items.multiItem, amount = input.items.amount, slot = input.slot});
                    else
                        bufferItems.Add(new RecipeInput<Item> {goods = input.items.singleItem, amount = input.items.amount, slot = input.slot});
                }

                recipe.itemInputs = bufferItems.ToArray();
                recipe.oreDictInputs = bufferOredict.ToArray();
            }
        }

        public static Repository Convert(DatabaseParser generator, List<string> icons)
        {
            var fluids = new Dictionary<string, Fluid>();
            var items = new Dictionary<string, Item>();
            var igroups = new Dictionary<string, ItemGroupBuilder>();
            var fgroups = new Dictionary<string, FluidGroupBuilder>();
            var recipeTypesMap = new Dictionary<string, RecipeType>();
            var recipes = new Dictionary<string, RecipeBuilder>();
            var recipeTypes = new List<RecipeType>();
            var aspects = new Dictionary<string, string>();

            foreach (var fluid in generator.GetTableContents(fluid))
            {
                fluids[fluid.Id] = new Fluid()
                {
                    name = fluid.LocalizedName, id = fluid.Id, iconId = icons.Count, isGas = fluid.Gaseous, mod = fluid.ModId, internalName = fluid.InternalName,
                    numericId = fluid.FluidId, unlocalizedName = fluid.UnlocalizedName, nbt = fluid.Nbt
                };
                icons.Add(fluid.ImageFilePath);
            }

            foreach (var item in generator.GetTableContents(item))
            {
                if (ItemBanlist.IsItemBanned(item.ModId, item.InternalName, item.LocalizedName))
                    items[item.Id] = null;
                else
                {
                    items[item.Id] = new Item
                    {
                        name = item.LocalizedName, id = item.Id, tooltip = item.Tooltip, stackSize = item.MaxStackSize, mod = item.ModId,
                        internalName = item.InternalName, damage = item.ItemDamage, numericId = item.ItemId, unlocalizedName = item.UnlocalizedName, nbt = item.Nbt
                    };
                }
            }

            foreach (var container in generator.GetTableContents(fluidContainer))
                if (items.TryGetValue(container.ContainerId, out var item) && item != null)
                    item.container = new FluidContainer() { fluid = fluids[container.FluidStackFluidId], amount = container.FluidStackAmount, empty = items[container.EmptyContainerId] };

            foreach (var itemGroup in generator.GetTableContents(itemGroup))
                igroups[itemGroup.Id] = new ItemGroupBuilder() {iid = itemGroup.Id};

            foreach (var itemGroup in generator.GetTableContents(itemGroup))
                igroups[itemGroup.Id].baseItemGroup = igroups[itemGroup.BaseItemGroupId];

            foreach (var fluidGroup in generator.GetTableContents(fluidGroup))
                fgroups[fluidGroup.Id] = new FluidGroupBuilder();

            var rawRecipeTypes = generator.GetTableContents(recipeType);
            foreach (var recipeGroup in rawRecipeTypes.GroupBy(x =>
                     {
                         var name = x.Type;
                         if (x.Category == "gregtech")
                         {
                             var bracket = name.IndexOf(" (", StringComparison.Ordinal);
                             if (bracket >= 0)
                                 name = name.Substring(0, bracket);
                         }
                         return name;
                     }))
            {
                var example = recipeGroup.First();

                var type = new RecipeType
                {
                    name = recipeGroup.Key, fluidInputs = new RecipeDimensions { x = example.FluidInputDimensionWidth, y = example.FluidInputDimensionHeight },
                    category = example.Category,
                    fluidOutputs = new RecipeDimensions { x = example.FluidOutputDimensionWidth, y = example.FluidOutputDimensionHeight },
                    itemInputs = new RecipeDimensions { x = example.ItemInputDimensionWidth, y = example.ItemInputDimensionHeight },
                    itemOutputs = new RecipeDimensions { x = example.ItemOutputDimensionWidth, y = example.ItemOutputDimensionHeight },
                    shapeless = example.Shapeless
                };

                foreach (var recipeType in recipeGroup)
                    recipeTypesMap[recipeType.Id] = type;
                recipeTypes.Add(type);
            }

            foreach (var typeItem in generator.GetTableContents(recipeTypeItem))
            {
                var recipe = recipeTypesMap[typeItem.RecipeTypeId];
                var item = items[typeItem.IconId];
                if (!recipe.crafters.Contains(item))
                    recipe.crafters.Add(item);
            }
            
            foreach (var itemStack in generator.GetTableContents(itemGroupItemStacks))
                igroups[itemStack.ItemGroupId].variants.Add(new RecipeInput<Item> {goods = items[itemStack.ItemStacksItemId], amount = itemStack.ItemStacksStackSize});

            foreach (var oreDict in generator.GetTableContents(oreDictionary))
                igroups[oreDict.ItemGroupId].oredict = oreDict.Name;

            foreach (var (_, value) in igroups)
                value.variants.RemoveAll(x => x.goods == null);

            foreach (var recipe in generator.GetTableContents(recipe))
                recipes[recipe.Id] = new RecipeBuilder() { recipe = new Recipe {recipeType = recipeTypesMap[recipe.RecipeTypeId], id = recipe.Id} };

            foreach (var gt in generator.GetTableContents(gregTechRecipe))
            {
                recipes[gt.RecipeId].recipe.gtInfo = new GtRecipeInfo
                {
                    amperage = gt.Amperage, voltage = gt.Voltage, voltageTier = VoltageTiers.GetVoltageTier(gt.VoltageTier), durationTicks = gt.Duration, cleanRoom = gt.RequiresCleanroom,
                    lowGravity = gt.RequiresLowGravity, additionalInfo = gt.AdditionalInfo, specialValue = gt.RecipeSpecialValue,
                };
            }

            foreach (var fluidGroup in generator.GetTableContents(recipeFluidGroup))
                recipes[fluidGroup.RecipeId].fluidInputs.Add((fluidGroup.FluidInputsKey, fgroups[fluidGroup.FluidInputsId]));
            
            foreach (var itemGroup in generator.GetTableContents(recipeItemGroup))
                recipes[itemGroup.RecipeId].itemInputs.Add((itemGroup.ItemInputsKey, igroups[itemGroup.ItemInputsId]));

            foreach (var fluidGroup in generator.GetTableContents(recipeFluidOutputs))
                recipes[fluidGroup.RecipeId].fluidOutputs.Add(new RecipeProduct<Fluid>
                {
                    slot = fluidGroup.FluidOutputsKey, amount = fluidGroup.FluidOutputsValueAmount, probability = (float)fluidGroup.FluidOutputsValueProbability,
                    goods = fluids[fluidGroup.FluidOutputsValueFluidId]
                });

            foreach (var itemGroup in generator.GetTableContents(recipeItemOutputs))
            {
                recipes[itemGroup.RecipeId].itemOutputs.Add(new RecipeProduct<Item>
                {
                    slot = itemGroup.ItemOutputsKey, amount = itemGroup.ItemOutputsValueStackSize, probability = (float)itemGroup.ItemOutputsValueProbability,
                    goods = items[itemGroup.ItemOutputsValueItemId]
                });
            }

            foreach (var fluidStack in generator.GetTableContents(fluidGroupFluidStacks))
                fgroups[fluidStack.FluidGroupId].fluid = new RecipeInput<Fluid>{goods = fluids[fluidStack.FluidStacksFluidId], amount = fluidStack.FluidStacksAmount};
            
            foreach (var (_, recipe) in recipes)
                recipe.MarkUsedItems();
            
            foreach (var (_, igroup) in igroups)
                igroup.MarkUsedItems();
            
            foreach (var (_, igroup) in igroups)
                igroup.Compile();
            
            foreach (var (_, recipe) in recipes)
                recipe.Compile();


            var repository = new Repository();

            foreach (var (_, v) in items)
            {
                if (v != null && v.container != null)
                    v.touched = true;
            }

            foreach (var item in generator.GetTableContents(item))
            {
                var itemData = items[item.Id];
                if (itemData != null && itemData.touched)
                {
                    itemData.iconId = icons.Count;
                    icons.Add(item.ImageFilePath);
                }
            }

            foreach (var aspectModel in generator.GetTableContents(aspect))
            {
                aspects[aspectModel.Id] = aspectModel.Name;
            }

            foreach (var aspectEntryModel in generator.GetTableContents(aspectEntry))
            {
                var item = items[aspectEntryModel.ItemId];
                if (item == null)
                    continue;
                item.aspects.Add(new ItemAspect {name = aspects[aspectEntryModel.AspectId], amount = aspectEntryModel.Amount});
            }

            //repository.items = items.Values.Where(x => x != null && x.touched).ToArray();
            repository.items = items.Values.Where(x => x != null && x.touched).ToList();
            repository.fluids = fluids.Values.ToList();
            repository.oreDicts = igroups.Values.Select(x => x.multiItem).Where(x => x != null).Distinct().ToList();
            repository.recipeTypes = recipeTypes;
            repository.recipes = recipes.Values.Select(x => x.banned ? null : x.recipe).Where(x => x != null).ToList();
            
            foreach (var item in repository.items)
                item.GenerateId();
            foreach (var item in repository.fluids)
                item.GenerateId();
            var existingOreDictIds = new Dictionary<string, OreDict>();
            foreach (var item in repository.oreDicts)
            {
                item.GenerateId(repository);
                if (existingOreDictIds.TryGetValue(item.id, out var existing) && (existing.variants.Length != item.variants.Length || existing.variants.Any(x => !item.variants.Contains(x))))
                    Console.Error.Write("Oredict conflict id: " + item.id);
                existingOreDictIds[item.id] = item;
            }
            return repository;
        }
    }
}