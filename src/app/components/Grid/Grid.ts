import { Utils } from "../../utils/Utils";
import { TGridParams } from "./structures/TGridParams";
import GridAttributeHooks from "./structures/GridAttributeHooks";
import { TGridItemProperties } from "./structures/TGridItemProperties";
import { TInitialDragViewportParams } from "../List/structures/TInitialDragViewportParams";
import { PointerEventHandler } from "../../utils/pointer-event-handler/PointerEventHandler";
import { PointerEventType } from "../../utils/pointer-event-handler/structures/PointerEventType";
import { TGridItemPlacement } from "./structures/TGridItemPlacement";
import { SyntheticEvent } from "../../utils/pointer-event-handler/structures/SyntheticEvent";
import { Direction } from "../../structures/Direction";
import { TTranslate } from "../../utils/smooth-translate/structures/TTranslate";
import { smoothTranslate } from "../../utils/smooth-translate/smoothTranslate";
import { TGridMapData } from "./structures/TGridMapData";
import { GridUtils } from "./utils/GridUtils";
import { TGridDragState } from "./structures/TGridDragState";
import { TGridView } from "./structures/TGridView";
import { TGridDimensions } from "./structures/TGridDimensions";
import { TTranslations } from "../../structures/TTranslations";
import { TCoords } from "../../structures/TCoords";
import { autoScroll } from "../../utils/auto-scroll/autoScroll";
import { Orientation } from "../../structures/Orientation";
import ResizeService from "../../services/resizeService/ResizeService";

export class Grid {

    private gridElement: HTMLElement;
    private placeholderElement: HTMLElement;
    private scrollableContainer: HTMLElement;
    private pointerEventHandler: PointerEventHandler;

    private readonly emptyMarker: number = -1;
    private gridParams: TGridParams;
    private dragState: TGridDragState | null = null;

    constructor(container: HTMLElement, params: TGridParams) {
        this.gridParams = params;
        this.pointerEventHandler = new PointerEventHandler();
        this.bindMethods();
        this.constructComponent(container, params);
    }

    public dispose(): void {
        this.pointerEventHandler.flushAll();
        ResizeService.unsubscribe(this.scrollableContainer);
    }

    private bindMethods(): void {
        this.onActionStart = this.onActionStart.bind(this);
        this.onDragStart = this.onDragStart.bind(this);
        this.onDragMove = this.onDragMove.bind(this);
        this.onDragEnd = this.onDragEnd.bind(this);
    }

    private constructComponent(container: HTMLElement, params: TGridParams): void {
        const gridTemplate: string = require("./grid.tpl.html");
        const gridElement: HTMLElement = Utils.createElementFromTemplate(gridTemplate);
        GridUtils.setGridTemplateColumns(gridElement, container, params);
        GridUtils.setGridGaps(gridElement, params.rowGap, params.columnGap);
        this.gridElement = gridElement;
        container.append(gridElement);
        this.placeholderElement = this.createPlaceholderElement();
        this.scrollableContainer = container;
        if (params.watchAnyResize) {
            ResizeService.subscribeToAny(this.scrollableContainer, () => GridUtils.setGridTemplateColumns(gridElement, container, params));
        } else {
            ResizeService.subscribeToWindow(container, () => GridUtils.setGridTemplateColumns(gridElement, container, params));
        }
    }

    private createPlaceholderElement(): HTMLElement {
        const template: string = require('./templates/placeholder.tpl.html');
        const placeholderElement: HTMLElement = Utils.createElementFromTemplate(template);
        placeholderElement.setAttribute(GridAttributeHooks.item, '');
        return placeholderElement;
    }

    public addItemWithClass(content: HTMLElement): void {
        const item: HTMLElement = this.createItem(content);
        this.gridElement.append(item);
        const itemProperties: TGridItemProperties = GridUtils.getGridItemProperties(content, this.gridParams.columnCount);
        this.setGridItemAttributes(item, itemProperties.rowspan, itemProperties.colspan);
        this.setGridItemStyles(item, itemProperties.rowspan, itemProperties.colspan);
        if (this.gridParams.allowDynamicClassChange) {
            this.setClassObserver(item);
        }
    }

    private setClassObserver(item: HTMLElement): void {
        const classChangeElement: HTMLElement = item.firstElementChild as HTMLElement;
        const observer: MutationObserver = new MutationObserver((_mutations: MutationRecord[]) => {
            const itemProperties: TGridItemProperties = GridUtils.getGridItemProperties(classChangeElement as HTMLElement, this.gridParams.columnCount);
            this.setGridItemAttributes(item, itemProperties.rowspan, itemProperties.colspan);
            this.setGridItemStyles(item, itemProperties.rowspan, itemProperties.colspan);
        });
        observer.observe(classChangeElement, {
            attributes: true,
            attributeFilter: ['class']
        });
    }

    private setGridItemAttributes(item: HTMLElement, rowspan: number, colspan: number): void {
        item.setAttribute(GridAttributeHooks.rowspan, rowspan.toString());
        item.setAttribute(GridAttributeHooks.colspan, colspan.toString());
    }

    private setGridItemStyles(item: HTMLElement, rowspan: number, colspan: number): void {
        item.style.gridRowStart = `span ${rowspan}`;
        item.style.gridColumnStart = `span ${colspan}`;
    }

    private createItem(content: HTMLElement): HTMLElement {
        const wrapper: HTMLElement = document.createElement('div');
        wrapper.setAttribute(GridAttributeHooks.item, '');
        wrapper.append(content);
        const dragAnchor: HTMLElement = Utils.getElementByAttribute(content, GridAttributeHooks.itemDragAnchor);
        if (!dragAnchor) {
            throw new Error('Provided element has no dragAnchor attribute!');
        }
        this.pointerEventHandler.addEventListener(dragAnchor, PointerEventType.ActionStart, this.onActionStart);
        return wrapper;
    }

    private createGridMapData(itemsList: HTMLElement[], columnCount: number): TGridMapData {
        return GridUtils.createGridDataView(
            itemsList,
            columnCount,
            this.emptyMarker,
            (item) => parseFloat(item.getAttribute(GridAttributeHooks.rowspan)),
            (item) => parseFloat(item.getAttribute(GridAttributeHooks.colspan)))
    }

    private calculateInitialDragViewportParams(event: SyntheticEvent): TInitialDragViewportParams {
        const scrollableContainerClientRect: ClientRect = this.scrollableContainer.getBoundingClientRect();
        const gridElementClientRect: ClientRect = this.gridElement.getBoundingClientRect();
        const windowWidth: number = window.innerWidth || document.body.clientWidth;
        const windowHeight: number = window.innerHeight || document.body.clientHeight;
        const gridContainerVisibleWidth: number = windowWidth - gridElementClientRect.left;
        const gridContainerVisibleHeight: number = windowHeight - gridElementClientRect.top;
        return {
            initialCoordinates: { x: event.clientX, y: event.clientY },
            initialComponentScrollTop: this.gridElement.scrollTop,
            initialComponentTop: scrollableContainerClientRect.top,
            initialComponentLeft: scrollableContainerClientRect.left,
            initialComponentScrollLeft: this.gridElement.scrollLeft,
            initialGridElementLeft: gridElementClientRect.left,
            initialGridElementTop: gridElementClientRect.top,
            horizontalScrollTriggerWidth: gridContainerVisibleWidth * 0.1,
            verticalScrollTriggerHeight: gridContainerVisibleHeight * 0.1
        }
    }

    private createInitialDragState(event: SyntheticEvent, itemsList: HTMLElement[], draggedElement: HTMLElement): TGridDragState {
        const initialDragViewportParams: TInitialDragViewportParams = this.calculateInitialDragViewportParams(event);
        const gridMapData: TGridMapData = this.createGridMapData(itemsList, this.gridParams.columnCount);
        const placeholderIndex: number = itemsList.indexOf(this.placeholderElement);
        const gridDimensions: TGridDimensions = GridUtils.calculateGridDimensions(this.gridElement, gridMapData.gridMap, this.gridParams.columnCount, this.gridParams.rowGap, this.gridParams.columnGap, null);
        const itemTranslations: WeakMap<HTMLElement, TTranslations> = new WeakMap();
        itemsList.forEach(item => itemTranslations.set(item, { translateX: 0, translateY: 0 }));
        const gridView: TGridView = { gridDimensions, itemsList, gridMapData, itemTranslations };
        return {
            initialDragViewportParams,
            draggedElement,
            placeholderIndex,
            originalDragItemsList: itemsList,
            gridView: gridView,
            containerScrollCallbacks: null,
            isTranslating: false,
        }
    }

    private onActionStart(event: SyntheticEvent): void {
        if (this.dragState) {
            return;
        };
        this.pointerEventHandler.addEventListener(document, PointerEventType.ActionMove, this.onDragStart);
    }

    private onDragStart(event: SyntheticEvent): void {
        this.pointerEventHandler.removeEventListener(document, PointerEventType.ActionMove, this.onDragStart);
        const clickedElement: HTMLElement = event.target as HTMLElement;
        const draggedElement: HTMLElement = this.getClosestGridItem(clickedElement);
        this.setPlaceholderStyles(draggedElement);
        const dragItemsList: HTMLElement[] = [...this.gridElement.children] as HTMLElement[];
        const draggedElementIndex: number = dragItemsList.indexOf(draggedElement);
        dragItemsList.splice(draggedElementIndex, 1, this.placeholderElement);
        this.dragState = this.createInitialDragState(event, dragItemsList, draggedElement);
        this.setDraggedElementStyles(draggedElement);
        this.detachDraggedElement(this.dragState.draggedElement, this.placeholderElement);
        this.pointerEventHandler.addEventListener(document, PointerEventType.ActionMove, this.onDragMove);
        this.pointerEventHandler.addEventListener(document, PointerEventType.ActionEnd, this.onDragEnd);
        this.onDragMove(event);
    }

    private isBetween(value: number, min: number, max: number, inclusive?: boolean): boolean {
        return value > min && value < max;
    }

    private onDragMove(event: SyntheticEvent): void {
        const xTranslation: number = event.clientX - this.dragState.initialDragViewportParams.initialCoordinates.x;
        const yTranslation: number = event.clientY - this.dragState.initialDragViewportParams.initialCoordinates.y;
        this.setTranslation(this.dragState.draggedElement, xTranslation, yTranslation);
        if (this.dragState.isTranslating) {
            return;
        }
        const gridClientX: number = this.scrollableContainer.scrollLeft + event.clientX - this.dragState.initialDragViewportParams.initialGridElementLeft;
        const gridClientY: number = this.scrollableContainer.scrollTop + event.clientY - this.dragState.initialDragViewportParams.initialGridElementTop;
        const gridCoords: TCoords = GridUtils.calculateGridCoords(gridClientX, gridClientY, this.dragState.gridView.gridDimensions);
        const previousGridMap: Int16Array[] = this.dragState.gridView.gridMapData.gridMap;





        const newPlaceholderPosition: number = this.findNewPlaceholderPosition(previousGridMap, this.dragState.gridView.itemTranslations, gridCoords, gridClientX);
        if (this.dragState.placeholderIndex !== newPlaceholderPosition) {
            const sledge = this.dragState.placeholderIndex < newPlaceholderPosition ? Math.max(0, newPlaceholderPosition - 1) : newPlaceholderPosition;
            const currentItemList: HTMLElement[] = this.getNewItemList(this.dragState.gridView.itemsList, this.dragState.placeholderIndex, sledge);
            const currentGridMapData: TGridMapData = this.createGridMapData(currentItemList, this.gridParams.columnCount);
            const currentGridDimensions: TGridDimensions = GridUtils.calculateGridDimensions(this.gridElement, currentGridMapData.gridMap, this.gridParams.columnCount, this.gridParams.rowGap, this.gridParams.columnGap, this.dragState.gridView.gridDimensions);
            const currentItemTranslations = this.createAnimations(this.dragState.gridView, currentItemList, currentGridMapData, currentGridDimensions);
            GridUtils.calculateForbiddenTrigger(currentGridMapData.gridMap, gridClientX, gridCoords, currentItemList, currentItemTranslations);
            this.dragState.gridView = {
                itemsList: currentItemList,
                gridDimensions: currentGridDimensions,
                gridMapData: currentGridMapData,
                itemTranslations: currentItemTranslations
            }
            this.dragState.placeholderIndex = sledge;
        }

        const { horizontalScrollTriggerWidth, verticalScrollTriggerHeight } = this.dragState.initialDragViewportParams;

        const gridX: number = event.clientX - this.dragState.initialDragViewportParams.initialComponentLeft;
        const gridY: number = event.clientY - this.dragState.initialDragViewportParams.initialComponentTop;
        const incrementReducer: number = 0.1;
        let horizontalIncrement: number | null = null;
        if (this.isBetween(gridX, 0, horizontalScrollTriggerWidth)) {
            horizontalIncrement = -(horizontalScrollTriggerWidth - gridX) * incrementReducer;
        } else if (this.isBetween(gridX, this.scrollableContainer.clientWidth - horizontalScrollTriggerWidth, this.scrollableContainer.clientWidth)) {
            horizontalIncrement = (horizontalScrollTriggerWidth - (this.scrollableContainer.clientWidth - gridX)) * incrementReducer;
        }

        let verticalIncrement: number | null = null;
        if (this.isBetween(gridY, 0, verticalScrollTriggerHeight)) {
            verticalIncrement = -(verticalScrollTriggerHeight - gridY) * incrementReducer;
        } else if (this.isBetween(gridY, this.scrollableContainer.clientHeight - verticalScrollTriggerHeight, this.scrollableContainer.clientHeight)) {
            verticalIncrement = (verticalScrollTriggerHeight - (this.scrollableContainer.clientHeight - gridY)) * incrementReducer;
        }

        const shouldScroll: boolean = horizontalIncrement !== null || verticalIncrement !== null;

        if (shouldScroll) {
            if (this.dragState.containerScrollCallbacks) {
                this.dragState.containerScrollCallbacks.setIncrement(Orientation.Horizontal, horizontalIncrement || 0);
                this.dragState.containerScrollCallbacks.setIncrement(Orientation.Vertical, verticalIncrement || 0);
            } else {
                this.dragState.containerScrollCallbacks = autoScroll(this.scrollableContainer, horizontalIncrement, verticalIncrement, () => this.onDragMove({ ...event }));
            }
        } else if (this.dragState.containerScrollCallbacks) {
            this.dragState.containerScrollCallbacks.cancel();
            this.dragState.containerScrollCallbacks = null;
        }
    }

    private createAnimations(previousGridView: TGridView, currentItemsList: HTMLElement[], currentGridMapData: TGridMapData, currentGridDimensions: TGridDimensions): WeakMap<HTMLElement, TTranslations> {
        let translations: TTranslate[] = [];
        const currentItemTranslations: WeakMap<HTMLElement, TTranslations> = new WeakMap();
        currentItemsList.forEach((item) => {
            const previousPlacement: TGridItemPlacement = previousGridView.gridMapData.itemPlacements.get(item);
            const currentPlacement: TGridItemPlacement = currentGridMapData.itemPlacements.get(item);
            const hasPlacementChanged: boolean = previousPlacement.x !== currentPlacement.x || previousPlacement.y !== currentPlacement.y;
            if (hasPlacementChanged) {
                const previousTranslations: TTranslations = previousGridView.itemTranslations.get(item);
                const xDirectTranslateValue: number = Utils.createRange(Math.min(previousPlacement.x, currentPlacement.x), Math.max(previousPlacement.x, currentPlacement.x)).reduce((sum, curr) => sum += currentGridDimensions.columnWidth + currentGridDimensions.columnGap, 0) * Math.sign(currentPlacement.x - previousPlacement.x);
                const yDirectTranslateValue: number = Utils.createRange(Math.min(previousPlacement.y, currentPlacement.y), Math.max(previousPlacement.y, currentPlacement.y)).reduce((sum, curr) => sum += currentGridDimensions.rowHeight + currentGridDimensions.rowGap, 0) * Math.sign(currentPlacement.y - previousPlacement.y);
                const adjustedXTranslateValue: number = previousTranslations.translateX + xDirectTranslateValue;
                const adjustedYTranslateValue: number = previousTranslations.translateY + yDirectTranslateValue;
                currentItemTranslations.set(item, { translateX: adjustedXTranslateValue, translateY: adjustedYTranslateValue });
                translations.push({
                    fromX: previousTranslations.translateX,
                    fromY: previousTranslations.translateY,
                    element: item,
                    toX: adjustedXTranslateValue,
                    toY: adjustedYTranslateValue,
                })
            } else {
                const previousTranslations: TTranslations = previousGridView.itemTranslations.get(item);
                currentItemTranslations.set(item, { translateX: previousTranslations.translateX, translateY: previousTranslations.translateY });
            }
        });
        this.dragState.isTranslating = true;
        smoothTranslate(translations, 200, () => {
            this.dragState.isTranslating = false;
        });
        return currentItemTranslations;
    }

    private getNewItemList(itemList: HTMLElement[], previousPlaceholderIndex: number, newPlaceholderIndex: number): HTMLElement[] {
        const newItemList: HTMLElement[] = [...itemList];
        Utils.moveItemInArray(newItemList, previousPlaceholderIndex, newPlaceholderIndex);
        return newItemList;
    }

    private findNewPlaceholderPosition(gridMap: Int16Array[], itemTranslations: WeakMap<HTMLElement, TTranslations>, gridCoords: TCoords, gridClientX: number): number {
        let newPlaceholderPosition: number;
        const currentItemMarker: number = gridMap[gridCoords.y][gridCoords.x];
        if (currentItemMarker === this.emptyMarker) {
            const gridCoordsToTheLeft: TCoords = { x: gridCoords.x - 1, y: gridCoords.y };
            const itemMarkerToTheLeft: number | null = GridUtils.findFirstItemMarkerUsingLeftFlow(gridMap, gridCoordsToTheLeft, this.emptyMarker);
            newPlaceholderPosition = itemMarkerToTheLeft === null ? 0 : itemMarkerToTheLeft + 1;
        } else {
            const item: HTMLElement = this.dragState.gridView.itemsList[currentItemMarker];
            if (item === this.placeholderElement) {
                newPlaceholderPosition = currentItemMarker;
            } else {
                const currentItemTranslations: TTranslations = itemTranslations.get(item);
                const itemCenterX: number = item.offsetLeft + (item.offsetWidth * 0.5) + currentItemTranslations.translateX;
                const itemSide: Direction = gridClientX < itemCenterX ? Direction.Left : Direction.Right;
                if (itemSide === Direction.Left) {
                    newPlaceholderPosition = currentItemMarker;
                } else {
                    newPlaceholderPosition = currentItemMarker + 1;
                }
            }
        }
        return newPlaceholderPosition;
    }

    private onDragEnd(event: SyntheticEvent): void {
        this.pointerEventHandler.removeEventListener(document, PointerEventType.ActionMove, this.onDragMove);
        this.pointerEventHandler.removeEventListener(document, PointerEventType.ActionEnd, this.onDragEnd);
        this.dragState.containerScrollCallbacks && this.dragState.containerScrollCallbacks.cancel();
        const placeholderPosition = this.dragState.gridView.gridMapData.itemPlacements.get(this.placeholderElement);
        const placeholderTranslation = this.dragState.gridView.itemTranslations.get(this.placeholderElement);
        var style = window.getComputedStyle(this.dragState.draggedElement);
        var matrix = new WebKitCSSMatrix(style.webkitTransform);
        smoothTranslate([{
            element: this.dragState.draggedElement,
            fromX: matrix.m41,
            fromY: matrix.m42,
            toX: placeholderTranslation.translateX,
            toY: placeholderTranslation.translateY
        }], 1000, () => {
            this.gridElement.removeChild(this.placeholderElement);
            this.removePlaceholderStyles();
            const from: number = this.dragState.originalDragItemsList.indexOf(this.placeholderElement);
            const to: number = this.dragState.placeholderIndex;
            [...this.gridElement.children].forEach(c => this.removeTranslation(c as HTMLHtmlElement));
            const beforeIndex: number = from < to ? to + 1 : to;
            const child: Node = this.gridElement.children.item(from);
            const toNode: Node = this.gridElement.children.item(beforeIndex);
            this.gridElement.insertBefore(child, toNode);
            this.removeDraggedElementStyles();
            this.dragState.draggedElement.style.position = '';
        });
    }

    private setTranslation(element: HTMLElement, x: number, y: number): void {
        element.style.transform = `translate(${x}px, ${y}px)`;
    }

    private removeTranslation(element: HTMLElement): void {
        element.style.transform = '';
    }

    private setPlaceholderStyles(mirrorGridItem: HTMLElement): void {
        const itemProperties: TGridItemProperties = GridUtils.getGridItemProperties(mirrorGridItem, this.gridParams.columnCount);
        this.setGridItemAttributes(this.placeholderElement, itemProperties.rowspan, itemProperties.colspan);
        this.placeholderElement.style.width = `${mirrorGridItem.offsetWidth}px`;
        this.placeholderElement.style.height = `${mirrorGridItem.offsetHeight}px`;
        this.placeholderElement.style.gridRowStart = `span ${itemProperties.rowspan}`;
        this.placeholderElement.style.gridColumnStart = `span ${itemProperties.colspan}`;
    }

    private removePlaceholderStyles(): void {
        this.placeholderElement.setAttribute(GridAttributeHooks.rowspan, "");
        this.placeholderElement.setAttribute(GridAttributeHooks.colspan, "");
        this.placeholderElement.style.width = ``;
        this.placeholderElement.style.height = ``;
        this.placeholderElement.style.gridRowStart = ``;
        this.placeholderElement.style.gridColumnStart = ``;
        this.removeTranslation(this.placeholderElement);
    }

    private setDraggedElementStyles(mirrorGridItem: HTMLElement): void {
        const mirrorItemClientRect: ClientRect = mirrorGridItem.getBoundingClientRect();
        this.dragState.draggedElement.style.top = `${mirrorItemClientRect.top}px`;
        this.dragState.draggedElement.style.left = `${mirrorItemClientRect.left}px`;
        this.dragState.draggedElement.style.width = `${this.dragState.draggedElement.offsetWidth}px`;
        this.dragState.draggedElement.style.height = `${this.dragState.draggedElement.offsetHeight}px`;
        this.dragState.draggedElement.style.zIndex = "1";
        this.dragState.draggedElement.style.pointerEvents = "none";
    }

    private removeDraggedElementStyles(): void {
        this.dragState.draggedElement.style.top = ``;
        this.dragState.draggedElement.style.left = ``;
        this.dragState.draggedElement.style.width = ``;
        this.dragState.draggedElement.style.height = ``;
        this.dragState.draggedElement.style.zIndex = ``;
        this.dragState.draggedElement.style.pointerEvents = ``;
    }

    private detachDraggedElement(draggedElement: HTMLElement, placeholderElement: HTMLElement): void {
        draggedElement.after(placeholderElement);
        draggedElement.style.position = "fixed";
    }

    private getClosestGridItem(fromElement: HTMLElement): HTMLElement | null {
        return fromElement.closest(`[${GridAttributeHooks.item}]`) as HTMLElement;
    }

}