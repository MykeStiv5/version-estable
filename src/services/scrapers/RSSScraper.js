'use strict';

class RSSScraper {
  async scrape() {
    return [
      {
        id: 'rss_demo_' + Date.now(),
        source: 'rss',
        title: 'RSS activo (demo)',
        description: 'Sistema RSS funcionando',
        link: '',
        imageUrl: null,
      }
    ];
  }
}

module.exports = new RSSScraper();