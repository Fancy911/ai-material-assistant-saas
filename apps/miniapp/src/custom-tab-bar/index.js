Component({
  data: {
    selected: 0,
    tabs: [
      { text: '首页', pagePath: '/pages/home/index', icon: '/static/tab-icons/home.png', activeIcon: '/static/tab-icons/home-active.png' },
      { text: '记录', pagePath: '/pages/history/index', icon: '/static/tab-icons/history.png', activeIcon: '/static/tab-icons/history-active.png' },
      { text: '我的', pagePath: '/pages/me/index', icon: '/static/tab-icons/me.png', activeIcon: '/static/tab-icons/me-active.png' },
    ],
  },
  lifetimes: {
    attached() { this.syncSelected(); },
  },
  pageLifetimes: {
    show() { this.syncSelected(); },
  },
  methods: {
    syncSelected() {
      const pages = getCurrentPages();
      const current = pages[pages.length - 1];
      const route = current ? `/${current.route}` : '/pages/home/index';
      const selected = this.data.tabs.findIndex((tab) => tab.pagePath === route);
      this.setData({ selected: selected < 0 ? 0 : selected });
    },
  },
});
