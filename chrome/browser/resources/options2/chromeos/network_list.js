// Copyright (c) 2012 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

cr.define('options.network', function() {

  var ArrayDataModel = cr.ui.ArrayDataModel;
  var List = cr.ui.List;
  var ListItem = cr.ui.ListItem;
  var Menu = cr.ui.Menu;
  var MenuItem = cr.ui.MenuItem;

  /**
   * Network settings constants. These enums usually match their C++
   * counterparts.
   */
  function Constants() {}

  // Network types:
  Constants.TYPE_UNKNOWN = 0;
  Constants.TYPE_ETHERNET = 1;
  Constants.TYPE_WIFI = 2;
  Constants.TYPE_WIMAX = 3;
  Constants.TYPE_BLUETOOTH = 4;
  Constants.TYPE_CELLULAR = 5;
  Constants.TYPE_VPN = 6;

  /**
   * Order in which controls are to appear in the network list sorted by key.
   */
  Constants.NETWORK_ORDER = ['ethernet',
                             'wifi',
                             'cellular',
                             'vpn',
                             'airplaneMode'];

  /**
   * ID of the menu that is currently visible.
   * @type {?string}
   * @private
   */
  var activeMenu_ = null;

  /**
   * Indicates if cellular networks are available.
   * @type{boolean}
   * @private
   */
  var cellularAvailable_ = false;

  /**
   * Indicates if cellular networks are enabled.
   * @type{boolean}
   * @private
   */
  var cellularEnabled_ = false;

  /**
   * List of wireless networks.
   * @type[Array.<Object>}
   * @private
   */
  var wirelessNetworks_ = null;

  /**
   * Create an element in the network list for controlling network
   * connectivity.
   * @param {Object} data Description of the network list or command.
   * @constructor
   */
  function NetworkListItem(data) {
    var el = cr.doc.createElement('li');
    el.data_ = {};
    for (var key in data)
      el.data_[key] = data[key];
    NetworkListItem.decorate(el);
    return el;
  }

  /**
   * Decorate an element as a NetworkListItem.
   * @param {!Element} el The element to decorate.
   */
  NetworkListItem.decorate = function(el) {
    el.__proto__ = NetworkListItem.prototype;
    el.decorate();
  };

  NetworkListItem.prototype = {
    __proto__: ListItem.prototype,

    /**
     * Description of the network group or control.
     * @type {Object.<string,Object>}
     * @private
     */
    data_: null,

    /**
     * Element for the control's subtitle.
     * @type {?Element}
     * @private
     */
    subtitle_: null,

    /**
     * Icon for the network control.
     * @type {?Element}
     * @private
     */
    icon_: null,

    /**
     * Indicates if in the process of connecting to a network.
     * @type {boolean}
     * @private
     */
    connecting_: false,

    /**
     * Description of the network control.
     * @type {Object}
     */
    get data() {
      return this.data_;
    },

    /**
     * Text label for the subtitle.
     * @type {string}
     */
    set subtitle(text) {
      this.subtitle_.textContent = text;
    },

    /**
     * URL for the network icon.
     * @type {string}
     */
    set iconURL(iconURL) {
      this.icon_.style.backgroundImage = url(iconURL);
    },

    /**
     * Type of network icon.  Each type corresponds to a CSS rule.
     * @type {string}
     */
    set iconType(type) {
      this.icon_.classList.add('network-' + type);
    },

    /**
     * Indicates if the network is in the process of being connected.
     * @type {boolean}
     */
    set connecting(state) {
      this.connecting_ = state;
      if (state)
        this.icon_.classList.add('network-connecting');
      else
        this.icon_.classList.remove('network-connecting');
    },

    get connecting() {
      return this.connecting_;
    },

    showSelector: function() {
      this.subtitle_.classList.add('network-selector');
    },

    /* @inheritDoc */
    decorate: function() {
      ListItem.prototype.decorate.call(this);
      this.className = 'network-group';
      this.icon_ = this.ownerDocument.createElement('div');
      this.icon_.className = 'network-icon';
      this.appendChild(this.icon_);
      var textContent = this.ownerDocument.createElement('div');
      this.appendChild(textContent);
      var categoryLabel = this.ownerDocument.createElement('div');
      var title = this.data_.key + 'Title';
      categoryLabel.className = 'network-title';
      categoryLabel.textContent = templateData[title];
      textContent.appendChild(categoryLabel);
      this.subtitle_ = this.ownerDocument.createElement('div');
      this.subtitle_.className = 'network-subtitle';
      textContent.appendChild(this.subtitle_);
    },
  };

  /**
   * Creates a control for selecting or configuring a network connection based
   * on the type of connection (e.g. wifi versus vpn).
   * @param{{key: string,
   *         networkList: Array.<Object>} data  Description of the network.
   * @constructor
   */
  function NetworkSelectorItem(data) {
    var el = new NetworkListItem(data);
    el.__proto__ = NetworkSelectorItem.prototype;
    el.decorate();
    return el;
  }

  NetworkSelectorItem.prototype = {
    __proto__: NetworkListItem.prototype,

    /* @inheritDoc */
    decorate: function() {
      this.createMenu_();
      // TODO(kevers): Generalize method of setting default label.
      var defaultMessage = this.data_.key == 'wifi' ?
          'networkOffline' : 'networkNotConnected';
      this.subtitle = templateData[defaultMessage];
      var list = this.data_.networkList;
      var candidateURL = null;
      for (var i = 0; i < list.length; i++) {
        var networkDetails = list[i];
        if (networkDetails.connecting || networkDetails.connected) {
          this.subtitle = networkDetails.networkName;
          candidateURL = networkDetails.iconURL;
          // Only break when we see a connecting network as it is possible to
          // have a connected network and a connecting network at the same
          // time.
          if (networkDetails.connecting) {
            this.connecting = true;
            candidateURL = null;
            break;
          }
        }
      }
      if (candidateURL)
        this.iconURL = candidateURL;
      else
        this.iconType = this.data.key;
      if (!this.connecting) {
        this.addEventListener('click', function() {
          this.showMenu();
        });
        this.showSelector();
      }
      // TODO(kevers): Add default icon for VPN when disconnected or in the
      // process of connecting.
    },

    /**
     * Creates a menu for selecting, configuring or disconnecting from a
     * network.
     * @private
     */
    createMenu_: function() {
      var menu = this.ownerDocument.createElement('div');
      menu.id = this.getMenuName_();
      menu.className = 'network-menu';
      menu.hidden = true;
      Menu.decorate(menu);
      var addendum = [];
      if (this.data_.key == 'wifi') {
        addendum.push({label: localStrings.getString('joinOtherNetwork'),
                       command: 'connect',
                       data: {networkType: Constants.TYPE_WIFI,
                              servicePath: '?'}});
      }
      var empty = true;
      var list = this.data_.networkList;
      if (list) {
        for (var i = 0; i < list.length; i++) {
          var data = list[i];
          if (!data.connected && !data.connecting) {
            // TODO(kevers): Check for a non-activated Cellular network.
            // If found, the menu item should trigger 'activate' instead
            // of 'connect'.
            if (data.networkType != Constants.TYPE_ETHERNET) {
              this.createConnectCallback_(menu, data);
              empty = false;
            }
          } else if (data.connected) {
            if (data.networkType == Constants.TYPE_WIFI) {
              addendum.push({label: localStrings.getString('networkShare'),
                            command: 'share',
                            data: data});
            }
            addendum.push({label: localStrings.getString('networkOptions'),
                           command: 'options',
                           data: data});
            if (data.networkType != Constants.TYPE_ETHERNET) {
              // Add separator
              addendum.push({});
              var i18nKey = data.networkType == Constants.TYPE_WIFI ?
                'disconnectWifi' : 'disconnect_button';
              addendum.push({label: localStrings.getString(i18nKey),
                             command: 'disconnect',
                             data: data});
              var onlineMessage = this.ownerDocument.createElement('div');
              onlineMessage.textContent =
                  localStrings.getString('networkOnline');
              onlineMessage.className = 'network-menu-header';
              menu.insertBefore(onlineMessage, menu.firstChild);
            }
          }
        }
      }
      if (addendum.length > 0) {
        if (!empty)
          menu.appendChild(MenuItem.createSeparator());
        for (var i = 0; i < addendum.length; i++) {
          var value = addendum[i];
          if (value.data) {
            this.createCallback_(menu,
                                 value.data,
                                 value.label,
                                 value.command);
          } else {
            menu.appendChild(MenuItem.createSeparator());
          }
        }
      }
      var parent = $('network-menus');
      var existing = $(menu.id);
      if (existing)
        parent.replaceChild(menu, existing);
      else
        parent.appendChild(menu);
    },

    /**
     * Adds a command to a menu, which calls back into chrome
     * for modifying network settings.
     * @param {!Element} menu Parent menu.
     * @param {Object} data Description of the network.
     * @param {string} label Display name for the menu item.
     * @param {string} command Name of the command for the
     *    callback.
     * @return {!Element} The created menu item.
     * @private
     */
    createCallback_: function(menu, data, label, command) {
      var button = this.ownerDocument.createElement('div');
      button.className = 'network-menu-item';
      button.textContent = label;
      var type = String(data.networkType);
      var path = data.servicePath;
      button.addEventListener('click', function() {
        chrome.send('buttonClickCallback',
                    [type, path, command]);
        closeMenu_();
      });
      MenuItem.decorate(button);
      menu.appendChild(button);
      return button;
    },

    /**
     * Adds a menu item for connecting to a network.
     * @param {!Element} menu Parent menu.
     * @param {Object} data Description of the network.
     * @private
     */
    createConnectCallback_: function(menu, data) {
      var menuItem = this.createCallback_(menu,
                                          data,
                                          data.networkName,
                                          'connect');
      menuItem.style.backgroundImage = url(data.iconURL);
    },

    /**
     * Retrieves the ID for the menu.
     * @private
     */
    getMenuName_: function() {
      return this.data_.key + '-network-menu';
    },

    /**
     * Displays a popup menu.
     */
    showMenu: function() {
      var top = this.offsetTop + this.clientHeight;
      var menuId = this.getMenuName_();
      if (menuId != activeMenu_) {
        closeMenu_();
        activeMenu_ = menuId;
        var menu = $(menuId);
        menu.style.setProperty('top', top + 'px');
        menu.hidden = false;
        setTimeout(function() {
          $('settings').addEventListener('click', closeMenu_);
        }, 0);
      }
    },
  };


  /**
   * Creates a button-like control for configurating internet connectivity.
   * @param{{key: string,
   *         subtitle: string,
   *         command: function} data  Description of the network control.
   * @constructor
   */
  function NetworkButtonItem(data) {
    var el = new NetworkListItem(data);
    el.__proto__ = NetworkButtonItem.prototype;
    el.decorate();
    return el;
  }

  NetworkButtonItem.prototype = {
    __proto__: NetworkListItem.prototype,

    /** @inheritDoc */
    decorate: function() {
      if (this.data.subtitle)
        this.subtitle = this.data.subtitle;
        if (this.data.command)
          this.addEventListener('click', this.data.command);
        if (this.data.iconURL)
          this.iconURL = this.data.iconURL;
    },
  };

  /**
   * A list of controls for manipulating network connectivity.
   * @constructor
   */
  var NetworkList = cr.ui.define('list');

  NetworkList.prototype = {
    __proto__: List.prototype,

    /** @inheritDoc */
    decorate: function() {
      List.prototype.decorate.call(this);
      this.addEventListener('blur', this.onBlur_);
      this.dataModel = new ArrayDataModel([]);
      this.update({key: 'wifi', networkList: []});
      this.update({key: 'airplaneMode',
                   subtitle: localStrings.getString('airplaneModeLabel'),
                   command: toggleAirplaneMode_});
    },

    /**
     * When the list loses focus, unselect all items in the list.
     * @private
     */
    onBlur_: function() {
      this.selectionModel.unselectAll();
    },

    /**
     * Finds the index of a network item within the data model based on
     * category.
     * @param {string} key Unique key for the item in the list.
     * @return {number} The index of the network item, or |undefined| if it is
     *     not found.
     */
    indexOf: function(key) {
      var size = this.dataModel.length;
      for (var i = 0; i < size; i++) {
        var entry = this.dataModel.item(i);
        if (entry.key == key)
          return i;
      }
    },

    /**
     * Updates a network control.
     * @param {Object.<string,string>} data Description of the entry.
     */
    update: function(data) {
      var index = this.indexOf(data.key);
      if (index == undefined) {
        // Find reference position for adding the element.  We cannot hide
        // individual list elements, thus we need to conditionally add or
        // remove elements and cannot rely on any element having a fixed index.
        for (var i = 0; i < Constants.NETWORK_ORDER.length; i++) {
          if (data.key == Constants.NETWORK_ORDER[i]) {
            data.sortIndex = i;
            break;
          }
        }
        var referenceIndex = -1;
        for (var i = 0; i < this.dataModel.length; i++) {
          var entry = this.dataModel.item(i);
          if (entry.sortIndex < data.sortIndex)
            referenceIndex = i;
          else
            break;
        }
        if (referenceIndex == -1) {
          // Prepend to the start of the list.
          this.dataModel.splice(0, 0, data);
        } else if (referenceIndex == this.dataModel.length) {
          // Append to the end of the list.
          this.dataModel.push(data);
        } else {
          // Insert after the reference element.
          this.dataModel.splice(referenceIndex + 1, 0, data);
        }
      } else {
        var entry = this.dataModel.item(index);
        data.sortIndex = entry.sortIndex;
        this.dataModel.splice(index, 1, data);
      }
    },

    /** @inheritDoc */
    createItem: function(entry) {
      if (entry.networkList)
        return new NetworkSelectorItem(entry);
      if (entry.command)
        return new NetworkButtonItem(entry);
    },

    /**
     * Deletes an element from the list.
     * @param{string} key  Unique identifier for the element.
     */
    deleteItem: function(key) {
      var index = this.indexOf(key);
      if (index != undefined) {
        var entry = this.dataModel.item(index);
        this.dataModel.splice(index, 1);
      }
    }
  };

  /**
   * Chrome callback for updating network controls.
   * @param {Object} data Description of available network devices and their
   *     corresponding state.
   */
  NetworkList.refreshNetworkData = function(data) {
    cellularAvailable_ = data.cellularAvailable;
    cellularEnabled_ = data.cellularEnabled;
    wirelessNetworks_ = data.wirelessList;

    // Only show Ethernet control if connected.
    var ethernetConnection = getConnection_(data.wiredList);
    if (ethernetConnection) {
      var type = String(Constants.TYPE_ETHERNET);
      var path = ethernetConnection.servicePath;
      var ethernetOptions = function() {
        chrome.send('buttonClickCallback',
                    [type, path, 'options']);
      };
      $('network-list').update({key: 'ethernet',
                        subtitle: localStrings.getString('networkConnected'),
                        iconURL: ethernetConnection.iconURL,
                        command: ethernetOptions});
    } else {
      $('network-list').deleteItem('ethernet');
    }

    // TODO(kevers): Store off list of remembered networks for use in the
    // "preferred networks" tab of the "More options..." dialog.

    loadData_('wifi',
              data.wirelessList,
              function(data) {
      return data.networkType == Constants.TYPE_WIFI;
    });

    // Only show cellular control if available and enabled.
    if (data.cellularEnabled && data.cellularAvailable) {
      loadData_('cellular',
                data.wirelessList,
                function(data) {
        return data.networkType == Constants.TYPE_CELLULAR;
      });
    } else {
      $('network-list').deleteItem('cellular');
    }

    // Only show VPN control if there is an internet connection.
    if (ethernetConnection || isConnected_(wirelessNetworks_))
      loadData_('vpn', data.vpnList);
    else
      $('network-list').deleteItem('vpn');

    $('network-list').invalidate();
    $('network-list').redraw();
  };

  /**
   * Updates the list of available networks and their status, filtered by
   * network type.
   * @param {string} category The type of network.
   * @param {Array} list The list of networks and their status.
   * @param {function(Object)=} opt_filter Optional filter for pruning the list
   *     of networks.
   */
  function loadData_(category, list, opt_filter) {
    var data = {key: category, networkList: list};
    if (opt_filter) {
      var filteredList = [];
      for (var i = 0; i < list.length; i++) {
        if (opt_filter(list[i]))
          filteredList.push(list[i]);
      }
      data.networkList = filteredList;
    }
    $('network-list').update(data);
  }

  /**
   * Hides the currently visible menu.
   * @private
   */
  function closeMenu_() {
    if (activeMenu_) {
      $(activeMenu_).hidden = true;
      activeMenu_ = null;
      $('settings').removeEventListener('click', closeMenu_);
    }
  }

  /**
   * Toggles airplane mode.
   * @private
   */
  function toggleAirplaneMode_() {
    if (cellularEnabled_ || isConnected_(wirelessNetworks_)) {
      chrome.send('disableWifi');
      if (cellularAvailable_)
        chrome.send('disableCellular');
      // TODO(kevers): Disable bluetooth.
    } else {
      chrome.send('enableWifi');
      if (cellularAvailable_)
        chrome.send('enableCellular');
      // TODO(kevers): Reenable bluetooth.
    }
  }

  /**
   * Determines if the user is connected to or in the process of connecting to
   * a wireless network.
   * @param{Array.<Object>} networkList List of networks.
   * @return{boolean} True if connected or connecting to a network.
   * @private
   */
  function isConnected_(networkList) {
    return getConnection_(networkList) != null;
  }

  /**
   * Fetches the active connection.
   * @param{Array.<Object>} networkList List of networks.
   * @return{boolean} True if connected or connecting to a network.
   * @private
   */
  function getConnection_(networkList) {
    if (!networkList)
      return null;
    for (var i = 0; i < networkList.length; i++) {
      var entry = networkList[i];
      if (entry.connected || entry.connecting)
        return entry;
    }
    return null;
  }

  // Export
  return {
    NetworkList: NetworkList
  };
});
