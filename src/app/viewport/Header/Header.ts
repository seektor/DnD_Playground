import HeaderClassHooks from './structures/HeaderClassHooks';
import HeaderAttributeHooks from './structures/HeaderAttributeHooks';
import { Utils } from '../../../common/utils/Utils';

export class Header {

    private navbarElement: HTMLElement;
    private activeElement: HTMLElement;

    constructor(container: HTMLElement) {
        this.constructComponent(container);
        // this.addNavbarItem('List', () => this.setActiveItem(0));
        this.addNavbarItem('Grid', () => this.setActiveItem(0));
        this.setActiveItem(0);
    }

    private constructComponent(container: HTMLElement): void {
        const headerTemplate: string = require('./header.tpl.html');
        const headerElement: HTMLElement = Utils.createElementFromTemplate(headerTemplate);
        this.navbarElement = Utils.getElementByAttribute(headerElement, HeaderAttributeHooks.navbar);
        container.append(headerElement);
    }

    public addNavbarItem(title: string, callback: () => void): void {
        const element: HTMLElement = document.createElement('div');
        element.innerHTML = title;
        element.onclick = callback;
        this.navbarElement.append(element);
    }

    public setActiveItem(index: number): void {
        if (this.activeElement) {
            this.activeElement.classList.remove(HeaderClassHooks.itemActive);
        }
        this.activeElement = this.navbarElement.children[index] as HTMLElement;
        this.activeElement.click();
        this.activeElement.classList.add(HeaderClassHooks.itemActive);
    }
}