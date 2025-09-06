var scrollbarWidth:number | undefined;

export function GetScrollbarWidth()
{
    if (scrollbarWidth === undefined) {
        // Create the measurement node
        var scrollDiv = document.createElement("div");
        scrollDiv.className = "scrollbar-measure";
        document.body.appendChild(scrollDiv);

        // Get the scrollbar width
        scrollbarWidth = scrollDiv.offsetWidth - scrollDiv.clientWidth;

        // Delete the DIV 
        document.body.removeChild(scrollDiv);
        console.log("Scrollbar width: "+scrollbarWidth);
    }
    return scrollbarWidth;
}

export type GtVoltageTier = {
    name:string;
    voltage:number;
}

export var voltageTier:GtVoltageTier[] = [
    {name: "LV", voltage: 32},
    {name: "MV", voltage: 128},
    {name: "HV", voltage: 512},
    {name: "EV", voltage: 2048},
    {name: "IV", voltage: 8192},
    {name: "LuV", voltage: 32768},
    {name: "ZPM", voltage: 131072},
    {name: "UV", voltage: 524288},
    {name: "UHV", voltage: 2097152},
    {name: "UEV", voltage: 8388608},
    {name: "UIV", voltage: 33554432},
    {name: "UMV", voltage: 134217728},
    {name: "UXV", voltage: 536870912},
    {name: "MAX", voltage: 2147483640},
    {name: "MAX+1", voltage: 2147483640*Math.pow(4, 1)},
    {name: "MAX+2", voltage: 2147483640*Math.pow(4, 2)},
    {name: "MAX+3", voltage: 2147483640*Math.pow(4, 3)},
    {name: "MAX+4", voltage: 2147483640*Math.pow(4, 4)},
    {name: "MAX+5", voltage: 2147483640*Math.pow(4, 5)},
    {name: "MAX+6", voltage: 2147483640*Math.pow(4, 6)},
    {name: "MAX+7", voltage: 2147483640*Math.pow(4, 7)},
    {name: "MAX+8", voltage: 2147483640*Math.pow(4, 8)},
    {name: "MAX+9", voltage: 2147483640*Math.pow(4, 9)},
    {name: "MAX+10", voltage: 2147483640*Math.pow(4, 10)},
    {name: "MAX+11", voltage: 2147483640*Math.pow(4, 11)},
  ];

export const TIER_LV = 0;
export const TIER_MV = 1;
export const TIER_HV = 2;
export const TIER_EV = 3;
export const TIER_IV = 4;
export const TIER_LUV = 5;
export const TIER_ZPM = 6;    
export const TIER_UV = 7;
export const TIER_UHV = 8;
export const TIER_UEV = 9;
export const TIER_UIV = 10;
export const TIER_UMV = 11;
export const TIER_UXV = 12;
export const TIER_MAX = 13;


export function formatAmount(amount: number): string {
    if (amount < 0.001) {
        if (amount === 0)
            return "0";
        if (amount < 0)
            return "-" + formatAmount(-amount);
        return "<0.001";
    }
    
    let suffix = '';
    let divisor = 1;
    
    if (amount >= 1e16) {
        suffix = 'P';
        divisor = 1e15;
    } else if (amount >= 1e13) {
        suffix = 'T';
        divisor = 1e12;
    } else if (amount >= 1e10) {
        suffix = 'G';
        divisor = 1e9;
    } else if (amount >= 1e7) {
        suffix = 'M';
        divisor = 1e6;
    } else if (amount >= 1e5) {
        suffix = 'K';
        divisor = 1000;
    }

    const dividedAmount = amount / divisor;
    const maxLength = 6 - suffix.length;
    const integerPart = Math.floor(dividedAmount).toString();
    const availableDecimals = Math.max(0, maxLength - integerPart.length - 1); // -1 for decimal point
    const div = Math.pow(10, availableDecimals);
    
    return (Math.round(dividedAmount * div) / div).toString() + suffix;
}