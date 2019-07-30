import { TDragViewportParams } from "../../List/structures/TDragViewportParams";
import { TGridView } from "./TGridView";
import { IAutoScrollCallbacks } from "../../common/utils/auto-scroll/interfaces/IAutoScrollCallbacks";
import { TTranslations } from "../../common/structures/TTranslations";

export interface TGridDragState {
    originalDragItemsList: HTMLElement[];
    originalDraggedElementIndex: number;
    dragViewportParams: TDragViewportParams;
    gridView: TGridView;
    draggedElement: HTMLElement;
    draggedElementTranslations: TTranslations;
    containerScrollCallbacks: IAutoScrollCallbacks;
    isTranslating: boolean;
}