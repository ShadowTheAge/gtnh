import { GetObjectName, GetObjectTooltip } from "./locale.js";
import { GetSingleRecipeDom } from "./nei.js";
import { Goods, Recipe, RecipeInOut } from "./repository.js";

export var currentTooltipElement:HTMLElement | undefined;
const tooltip = document.getElementById("tooltip")!;
const tooltipHeader = tooltip.querySelector("#tooltip-header") as HTMLElement;
const tooltipDebugInfo = tooltip.querySelector("#tooltip-debug") as HTMLElement;
const tooltipText = tooltip.querySelector("#tooltip-text") as HTMLElement;
const tooltipAction = tooltip.querySelector("#tooltip-action") as HTMLElement;
const tooltipMod = tooltip.querySelector("#tooltip-mod") as HTMLElement;
const tooltipRecipe = tooltip.querySelector("#tooltip-recipe") as HTMLElement;
let tooltipScrollTarget = 0;
let tooltipScrollCache = new Map<HTMLElement, number>();

interface TooltipData {
    header?: string;
    text?: string | null;
    action?: string | null;
    goods?: Goods;
    recipe?: Recipe | null;
    overrideIo?: RecipeInOut[];
}

function OnGlobalScroll(ev: WheelEvent) : any {
  if (!tooltip || tooltip.style.display !== "block") return;
  
  // Scroll inside tooltip instead of page
  tooltipScrollTarget += ev.deltaY;
  tooltipScrollTarget = Math.max(0, Math.min(tooltipScrollTarget, tooltip.scrollHeight - tooltip.clientHeight));
  if (tooltip.scrollTop !== tooltipScrollTarget) {
    tooltip.scrollTop = tooltipScrollTarget;
    ev.preventDefault(); // block normal page scroll
  }
}

export function ShowTooltip(target: HTMLElement, data: TooltipData): void {
    if (data == null)
        return;

    const header = data.goods ? GetObjectName(data.goods.id) : data.header ?? '';
    const debug = data.goods?.tooltipDebugInfo ?? null;
    const text = data.goods ? GetObjectTooltip(data.goods.id) : data.text ?? null;
    const mod = data.goods?.mod ?? null;
    const action = data.action ?? null;
    const recipe = data.recipe ?? null;
    const overrideIo = data.overrideIo;
    ShowTooltipRaw(target, header, debug, text, mod, action, recipe, overrideIo);
    target.focus();
    target.addEventListener("mouseleave", () => HideTooltip(target), { once: true });
    if (tooltipScrollCache.has(target)) {
        tooltipScrollTarget = tooltipScrollCache.get(target)!;
    } else {
        tooltipScrollTarget = 0;
    }
 
    // Override smooth scroll for the initial scroll loaded from cache.
    // Otherwise it scrolls visibly every time.
    tooltip.style.scrollBehavior = 'auto';
    tooltipScrollTarget = Math.max(0, Math.min(tooltipScrollTarget, tooltip.scrollHeight - tooltip.clientHeight));
    tooltip.scrollTop = tooltipScrollTarget;
    tooltip.style.scrollBehavior = 'smooth';
    
    window.addEventListener("wheel", OnGlobalScroll, { passive: false });
}

function SetTextOptional(element:HTMLElement, data: string | null, html: boolean)
{
    if (data === undefined || data === null)
        element.style.display = "none";
    else {
        element.style.display = "block";
        if (html)
            element.innerHTML = data;
        else
            element.textContent = data;
    }
}

function ShowTooltipRaw(target:HTMLElement, header:string, debug:string|null, description:string|null, mod:string|null, action:string|null, recipe:Recipe|null, overrideIo?:RecipeInOut[])
{
    tooltip.style.display = "block";
    currentTooltipElement = target;
    SetTextOptional(tooltipHeader, header, true);
    SetTextOptional(tooltipDebugInfo, debug, false);
    SetTextOptional(tooltipText, description, true);
    SetTextOptional(tooltipAction, action, false);
    SetTextOptional(tooltipMod, mod, false);

    tooltipRecipe.style.display = "none";
    if (recipe) {
        tooltipRecipe.style.display = "block";
        tooltipRecipe.innerHTML = GetSingleRecipeDom(recipe, overrideIo);
    }

    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    const isRightHalf = targetRect.left > window.innerWidth / 2;

    if (isRightHalf) {
        tooltip.style.left = `${targetRect.left - tooltipRect.width}px`;
    } else {
        tooltip.style.left = `${targetRect.right}px`;
    }

    if (targetRect.top + tooltipRect.height > window.innerHeight) {
        tooltip.style.top = `${window.innerHeight - tooltipRect.height}px`;
    } else {
        tooltip.style.top = `${Math.max(targetRect.top, 0)}px`;
    }
}

export function HideTooltip(target:HTMLElement)
{
    if (currentTooltipElement !== target)
        return;
    tooltipScrollCache.set(target, tooltipScrollTarget);
    currentTooltipElement = undefined;
    tooltip.style.display = "none";
    window.removeEventListener("wheel", OnGlobalScroll);
}

export function IsHovered(obj:HTMLElement):boolean
{
    return currentTooltipElement === obj;
}