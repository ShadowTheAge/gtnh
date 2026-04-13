using Source;

namespace GT_recipe_parser
{
    public class ItemModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("IMAGE_FILE_PATH")]
        public string ImageFilePath { get; set; }

        [SchemaName("INTERNAL_NAME")]
        public string InternalName { get; set; }

        [SchemaName("ITEM_DAMAGE")]
        public int ItemDamage { get; set; }

        [SchemaName("ITEM_ID")]
        public int ItemId { get; set; }

        [SchemaName("LOCALIZED_NAME")]
        public string LocalizedName { get; set; }

        [SchemaName("MAX_DAMAGE")]
        public int MaxDamage { get; set; }

        [SchemaName("MAX_STACK_SIZE")]
        public int MaxStackSize { get; set; }

        [SchemaName("MOD_ID")]
        public string ModId { get; set; }

        [SchemaName("NBT")]
        public string Nbt { get; set; }

        [SchemaName("UNLOCALIZED_NAME")]
        public string UnlocalizedName { get; set; }
    }

    public class ItemTooltipModel
    {
        [SchemaName("ITEM_ID")]
        public string ItemId { get; set; }

        [SchemaName("TOOLTIP")]
        public string Tooltip { get; set; }
        
        [SchemaName("TOOLTIP_ORDER")]
        public string TooltipOrder { get; set; }
    }

    public class ItemGroupModel
    {
        [SchemaName("ID")]
        public string Id { get; set; }

        [SchemaName("BASE_ITEM_GROUP_ID")]
        public string BaseItemGroupId { get; set; }
    }

    public class ItemGroupItemStacksModel
    {
        [SchemaName("ITEM_GROUP_ID")]
        public string ItemGroupId { get; set; }

        [SchemaName("ITEM_STACKS_ITEM_ID")]
        public string ItemStacksItemId { get; set; }

        [SchemaName("ITEM_STACKS_STACK_SIZE")]
        public int ItemStacksStackSize { get; set; }
    }

    public class ItemToolClassesModel
    {
        [SchemaName("ITEM_ID")]
        public string ItemId { get; set; }

        [SchemaName("TOOL_CLASSES")]
        public int ToolClasses { get; set; }

        [SchemaName("TOOL_CLASSES_KEY")]
        public string ToolClassesKey { get; set; }
    }
}