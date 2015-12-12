var React = require('react');
var inherits = require('inherits');
var batchedUpdates = require('react-dom').unstable_batchedUpdates;
var hoistNonReactStatics = require('hoist-non-react-statics');

module.exports = function changeBatcher(Component, strategy) {
    function ChangeBatcher (props, context) {
        React.Component.apply(this, arguments);
        var self = this;
        this.storeListeners = {};
        this.batch = null;
        this.changeBatcher = this.createChangeBatcher();
        this.depth = 0;
        this.transactionInterface = {
            isStarted: function () {
                return !!self.depth;
            },
            start: self.startTransaction.bind(self),
            end: self.endTransaction.bind(self)
        }
    }

    inherits(ChangeBatcher, React.Component);

    ChangeBatcher.displayName = 'ChangeBatcher';
    ChangeBatcher.contextTypes = {
        getStore: React.PropTypes.func.isRequired
    };
    ChangeBatcher.childContextTypes = {
        changeBatcher: React.PropTypes.object
    };

    ChangeBatcher.prototype.getChildContext = function () {
        return {
            changeBatcher: this.changeBatcher
        };
    };
    ChangeBatcher.prototype.createChangeBatcher = function () {
        var self = this;
        return {
            addStoreListener: function (Store, listener) {
                var storeName = typeof Store === 'string' ? Store : Store.storeName || Store.name;
                if (!self.storeListeners[storeName]) {
                    self.storeListeners[storeName] = [];
                    self.context.getStore(Store).addChangeListener(function (payload) {
                        self.batchedHandler(storeName, listener, payload);
                    });
                }
                self.storeListeners[storeName].push(listener);
            },
            removeStoreListener: function (Store, listener) {
                var storeName = typeof Store === 'string' ? Store : Store.storeName || store.name;
                if (self.storeListeners[storeName]) {
                    var index = self.storeListeners[storeName].indexOf(listener);
                    if (index > -1) {
                        self.storeListeners[storeName].splice(index, 1);
                    }
                }
            }
        };
    };
    ChangeBatcher.prototype.startTransaction = function () {
        // console.log('transaction started');
        if (null === this.batch) {
            this.batch = {};
        }
        ++this.depth;
    };
    ChangeBatcher.prototype.endTransaction = function () {
        var self = this;
        if (--this.depth === 0) {
            // console.log('transaction ended');
            if (!self.batch) {
                return;
            }
            batchedUpdates(function () {
                // console.log(Object.keys(self.batch));
                Object.keys(self.batch).forEach(self.processListeners, self);
                self.batch = null;
            }); 
        }
    };
    ChangeBatcher.prototype.batchedHandler = function (storeName, listener, payload) {
        strategy(storeName, this.context, this.transactionInterface);
        if (this.batch === null) {
            // console.log('No transaction, executing immediately');
            listener(payload); 
            return;
        } else {
            if (!this.batch[storeName]) {
                this.batch[storeName] = [];
            }
            this.batch[storeName].push(payload);   
        }
    };
    ChangeBatcher.prototype.processListeners = function (store) {
        // console.log('processing ' + store + ' handlers', this.storeListeners[store]);
        if (this.batch[store] && this.storeListeners[store]) {
            this.batch[store].forEach(function (payload) {
                this.storeListeners[store].forEach(function (listener) {
                    listener(payload);
                });
            }, this);
        }
    };
    ChangeBatcher.prototype.render = function () {
        return React.createElement(Component, Object.assign({}, this.props));
    };

    hoistNonReactStatics(ChangeBatcher, Component);

    return ChangeBatcher;
};
