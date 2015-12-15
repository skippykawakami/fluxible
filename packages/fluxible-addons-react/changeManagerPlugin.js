'use strict';

var batchedUpdates = require('react-dom').unstable_batchedUpdates;

function ChangeManager (context, strategy) {
    var self = this;
    self.context = context;
    self.strategy = strategy;
    self.internalListeners = {};
    self.storeListeners = {};
    self.batch = null;
    self.depth = 0;
    self.transactionInterface = {
        isStarted: function () {
            return !!self.depth;
        },
        start: self.startTransaction.bind(self),
        end: self.endTransaction.bind(self)
    }
}

ChangeManager.prototype.addStoreListener = function (storeName, listener) {
    var self = this;
    if (!self.storeListeners[storeName]) {
        self.storeListeners[storeName] = [];
    }
    self.storeListeners[storeName].push(listener);
    var internalListener = function (payload) {
        self.batchedHandler(storeName, listener, payload);
    };
    self.context.getStore(storeName).on('change', internalListener);
};

ChangeManager.prototype.removeStoreListener = function (storeName, listener) {
    var self = this;
    if (self.storeListeners[storeName]) {
        var index = self.storeListeners[storeName].indexOf(listener);
        if (index > -1) {
            var internalListener = self.internalListeners[storeName][index];
            self.storeListeners[storeName].splice(index, 1);
            self.internalListeners[storeName].splice(index, 1);
            self.context.getStore(storeName).removeListener('change', internalListener);
        }
    }
};
ChangeManager.prototype.startTransaction = function () {
    if (null === this.batch) {
        this.batch = {};
    }
    ++this.depth;
};
ChangeManager.prototype.endTransaction = function () {
    var self = this;
    if (--this.depth === 0) {
        if (!self.batch) {
            return;
        }
        batchedUpdates(function () {
            Object.keys(self.batch).forEach(self.processListeners, self);
            self.batch = null;
        });
    }
};
ChangeManager.prototype.batchedHandler = function (storeName, listener, payload) {
    this.strategy(storeName, this.context, this.transactionInterface);
    if (this.batch === null) {
        listener(payload);
        return;
    } else {
        if (!this.batch[storeName]) {
            this.batch[storeName] = [];
        }
        this.batch[storeName].push(payload);
    }
};
ChangeManager.prototype.processListeners = function (store) {
    if (this.batch[store] && this.storeListeners[store]) {
        this.batch[store].forEach(function (payload) {
            this.storeListeners[store].forEach(function (listener) {
                listener(payload);
            });
        }, this);
    }
};

module.exports = function changeManagerPlugin(options) {
    options = options || {};
    var strategy = options.strategy;

    return {
        name: 'ChangeManagerPlugin',
        plugContext: function (contextOptions, context) {
            var storeOverrides = {};
            var changeManager = new ChangeManager(context, strategy);
            return {
                plugComponentContext: function (componentContext) {
                    var oldGetStore = componentContext.getStore;
                    componentContext.getStore = function getStore(store) {
                        var storeName = typeof store === 'string' ? store : store.storeName || store.name;
                        store = oldGetStore(store);
                        if (!storeOverrides[storeName]) {
                            store.addChangeListener = function (listener) {
                                changeManager.addStoreListener(storeName, listener);
                            };
                            store.removeChangeListener = function (listener) {
                                changeManager.removeStoreListener(storeName, listener);
                            };
                            storeOverrides[storeName] = store;
                        }

                        return storeOverrides[storeName];
                    }
                }
            };
        }
    };
};
