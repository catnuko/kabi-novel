import Bar from "../common/bar/bar";
import { Book, CatalogueItem, changeValueWithNewObj, getSpecialParent, Progress } from "../common/common";
import Pagination from "../common/pagination/pagination";

class Catalogue {
    element: HTMLElement;
    bar: Bar;
    pagination: Pagination;

    currentBook: Book;
    progress: Progress;

    linePerPage: number;

    list: CatalogueItem[] = [];

    loading: boolean = false;

    cacheFlag: boolean = false;

    constructor() {
        this.element = document.querySelector('.page.catalogue');

        this.pagination = new Pagination({
            root: this.element.querySelector('.content')
        });
        
        this.bar = new Bar({
            element: this.element.querySelector('.bar'),
            pagination: this.pagination
        });

        const current: HTMLElement = this.element.querySelector('.current-info');
        const content: HTMLElement = this.element.querySelector('.content');
        window.Bind.bindView(this.element.querySelector('.article-list'), this, 'list', (list: any[]) => {
            // let height = (this.element.querySelector('.pagination-box') as HTMLElement).offsetHeight;
            let height = this.element.offsetHeight - 230 - 20;
            let oo = height % 80;
            if (oo < 10) {
                oo += 80;
            }
            this.linePerPage = Math.round((height - oo) / 80);
            current.style.height = `${oo}px`;
            current.style.lineHeight = `${oo}px`;
            content.style.height = `${height - oo + 20}px`;
            // this.linePerPage = Math.round(height / 80);
            // let line = height / this.linePerPage;
            let html = `
                <style>
                    .article-item {line-height: 80px;}
                </style>
            `;
            list.forEach((article, index) => {
                html += `
                    <div class="article-item " key="${article.index}">${article.title}</div>
                `;
            });
            window.setTimeout(() => {
                this.pagination.checkPage();
                this.checkCurrent();
            });
            return html;
        });

        window.Bind.bindView(current, this, 'currentBook', () => {
            return `${this.currentBook?.name} - ${this.currentBook?.author}`;
        });

        window.Bind.bind(this, 'progress', (newV: any, oldV: any) => {
            window.Store.setObj(`p_${this.currentBook.id}`, newV);
        });


        let func = () => {
            this.currentBook = window.BookShelf.bookMap[window.Store.get('current')];

            if (!this.currentBook) {
                if (window.Router.current === 'catalogue') {
                    window.Router.go('bookshelf');
                }
                return;
            }
            
            this.progress = window.Store.getObj(`p_${this.currentBook.id}`);

            this.list = window.Store.getObj(`c_${this.currentBook.id}`) || [];
            
            if (this.list.length === 0) {
                this.getCatalogue();
            }
        };

        window.Router.cbMap.catalogue = func;
        func();
    }

    checkCurrent(): void {
        if (!this.progress || !this.currentBook) {
            return;
        }
        this.element.querySelector('.article-item.current')?.classList.remove('current');
        this.element.querySelector(`.article-item[key="${this.progress.index}"]`)?.classList.add('current');

        let items = this.element.querySelectorAll('.article-item');
        let caches = window.Store.getByHead(`a_${this.currentBook.id}_`).map(v => {
            let arr = v.split('_');
            return arr[arr.length - 1];
        });
        caches.forEach((index) => {
            items[parseInt(index)]?.classList.add('cached');
        });
        this.pagination.setPage(Math.floor(this.progress.index / (this.linePerPage * 2)));
    }

    getCatalogue(): void {
        if (this.loading === true) {
            window.Message.add({content: '正在加载书架数据'});
            return;
        }
        this.loading = true;
        window.Api.getCatalogue(this.currentBook.source, {
            success: (res: any) => {
                this.loading = false;
                this.list = res.data.map((v: any) => {
                    return {
                        index: v.index,
                        title: v.title     
                    };
                });
                window.Store.setObj(`c_${this.currentBook.id}`, this.list);
            },
            error: (err: any) => {
                this.loading = false;
            }
        });
    }

    clickItem(event: Event): void {
        let item = getSpecialParent((event.target || event.srcElement) as HTMLElement, (ele: HTMLElement) => {
            return ele.classList.contains('article-item');
        });
        let index = parseInt(item.getAttribute('key'));
        this.progress = changeValueWithNewObj(this.progress, {index: index, title: this.list[index].title, time: new Date().getTime(), pos: 0});
        window.setTimeout(() => {
            window.Router.go('article');
        });
    }

    makeCache(start: number, end: number): void {
        if (start > end) {
            this.cacheFlag = false;
            window.Message.add({
                content: '缓存任务完成'
            });
            return;
        }
        if (window.Store.has(`a_${this.currentBook.id}_${start}`)) {
            this.makeCache(start + 1, end);
            return;
        }
        window.Api.getArticle(this.currentBook.source, start, {
            success: (res: any) => {
                window.Store.set(`a_${this.currentBook.id}_${start}`, res.data);
                this.element.querySelector(`.article-item[key="${start}"]`)?.classList.add('cached');
                this.makeCache(start + 1, end);
            },
            error: (err: any) => {
                window.Message.add({
                    content: `缓存章节《${this.list[start].title}》失败`
                });
                this.makeCache(start + 1, end);
            }
        });
    }

    doCache(val: number | 'end' | 'all'): void {
        if (this.cacheFlag) {
            window.Message.add({
                content: '正在缓存，请勿重复操作'
            });
            return;
        }
        this.cacheFlag = true;
        let start = this.progress.index;
        let last = this.list[this.list.length - 1].index;
        if (val === 'all') {
            start = 0;
        }
        if (typeof val === 'number') {
            last = Math.min(last, start + val);
        }
        this.makeCache(start, last);
    }

    deleteCache(type: 'readed' | 'all'): void {
        if (this.cacheFlag) {
            window.Message.add({
                content: '正在缓存，禁用删除操作'
            });
            return;
        }
        window.Store.getByHead(`a_${this.currentBook.id}_`).filter(v => !(type === 'readed' && parseInt(v.split('_')[2]) >= this.progress.index)).forEach(v => {
            window.Store.del(v);
            this.element.querySelector(`.article-item[key="${v.split('_')[2]}"]`)?.classList.remove('cached');
        });
        window.Message.add({
            content: '删除指定缓存完成'
        });
    }

    cache(): void {
        window.Modal.add({
            content: `
                <style>
                    .modal-content .button {
                        line-height: 60px;
                        padding: 20px;
                        width: 40%;
                        float: left;
                        margin: 10px;
                    }
                </style>
                <div class="button" onclick="Catalogue.doCache(20)">缓存20章</div>
                <div class="button" onclick="Catalogue.doCache(50)">缓存50章</div>
                <div class="button" onclick="Catalogue.doCache(100)">缓存100章</div>
                <div class="button" onclick="Catalogue.doCache(200)">缓存200章</div>
                <div class="button" onclick="Catalogue.doCache('end')">缓存未读</div>
                <div class="button" onclick="Catalogue.doCache('all')">缓存全文</div>
                <div class="button" onclick="Catalogue.deleteCache('readed')">删除已读</div>
                <div class="button" onclick="Catalogue.deleteCache('all')">删除全部</div>
            `,
        })
    }
};

export default Catalogue;