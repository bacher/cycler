"mail:abook";
/* abook.js begin */
(function(/**Jane*/Jane, /**Daria*/Daria) {
    /* jshint unused: false */

    var Block = Jane.Block;
    var Page = Jane.Page;
    var Actions = Jane.Actions;
    var Action = Jane.Action;
    var Handler = Jane.Handler;

    Daria.Abook = {};

    /* ../../js/components/abook.person.js begin */
(function() {

    var DIALOG_WIDTH = 640;
    var LOVER_BIRTH_YEAR = 1900;
    var CONTENT_MAX_HEIGHT_IE = 370;

    var base = {
        /**
         * Список параметров, которые будут прокинуты в xsl из параметров экшена.
         */
        jsonFields: [],

        $dialog: null,

        /**
         * Открыть попап с карточкой контакта.
         * @param {Object} params
         * @param {Object} event
         */
        open: function(params, event) {
            this.params = $.extend({}, params);
            if (event) {
                this.params.$openTarget = $(event.currentTarget);
            }

            this.$dialog = $('<div>');

            this.haveOtherChanges = false;

            this.removeLabels = {};

            if ($.isFunction(params.onadd)) {
                this.onadd = params.onadd;
            }

            this.loadData();
        },

        /**
         * Загрузка данных.
         */
        loadData: function() {
            var that = this;

            var jsxml = this.getJSON();
            var params = this.getParams();
            var handlers = this.getHandlers();
            handlers.push('abook-groups');

            Jane.Handler.getAll(handlers, params, function() {
                if (handlers.indexOf('abook-contact') !== -1) {
                    that.contactCache = jpath(Jane.$H('abook-contact').getCacheByParams(params), '.contact[0]')[0];
                }

                that.$dialog.html(Jane.tt('mail-abook:abook-person-popup', jsxml, handlers, params));
                that.cid = that.$dialog.find('.js-abook-contact').data('cid');

                that.formCacher = new Daria.nbFormCacher(that.$dialog, 'abook-person');
                that.formCacher.dirtyStateClass = '';
                that.formCacher.normalStateClass = '';

                that.nbSaveButton = nb.$block('.js-save-button', that.$dialog);

                if (that.nbSaveButton) {
                    that.onFormDirty = function(_, params) {
                        if (params.instance === 'abook-person') {
                            that.nbSaveButton.enable();
                        }
                    };

                    that.onFormNormal = function(_, params) {
                        if (params.instance === 'abook-person') {
                            if (!that.haveOtherChanges) {
                                that.nbSaveButton.disable();
                            }
                        }
                    };

                    Jane.events.bind('form-cacher.changed', that.onFormDirty);
                    Jane.events.bind('form-cacher.unchanged', that.onFormNormal);

                    var $emailInput = that.$dialog.find('.js-abook-person-new-email .js-abook-person-input');
                    if ($emailInput.length) {
                        that.nbNewEmail = nb.block($emailInput.get(0));
                    }

                    var $phoneInput = that.$dialog.find('.js-abook-person-new-phone .js-abook-person-input');
                    if ($phoneInput.length) {
                        that.nbNewPhone = nb.block($phoneInput.get(0));
                    }
                }

                that.initDate();
                that.bindEvents();
                that.openDialog();

                // TODO: Зачем таймаут?
                setTimeout(function() {
                    var node = that.$dialog.find('.b-mail-card__header__avatar').get(0);
                    Daria.SocialAvatarsAbookPerson(node, params);
                }, 100);
            });
        },

        /**
         * Инициализация обработчиков попапа.
         */
        bindEvents: function() {
            var that = this;

            this.$dialog.on('click', '.js-abook-person-all-messages-link', function() {
                Block.Abook.Metrika.c('Карточка контакта', 'Клики', 'Все письма от контакта');
            });

            this.$dialog.on('click', '.js-abook-person-remove', this.removeContact.bind(this));

            if (this.nbSaveButton) {
                this.$dialog.on('click', '.js-abook-remove-email', this.removeEmail.bind(this));
                this.$dialog.on('click', '.js-abook-remove-phone', this.removePhone.bind(this));
                this.$dialog.on('click', '.js-abook-remove-label', this.removeLabel.bind(this));
                this.$dialog.on('click', '.js-abook-date-text', function(e) {
                    var $inputContainer = $(e.currentTarget).closest('.b-mail-input');
                    $inputContainer.addClass('b-mail-input_focus');
                });

                this.$dialog.find('.js-abook-contact').scroll(function() {
                    that.nbSelectBDay.close();
                    that.nbSelectBMonth.close();
                    that.nbSelectBYear.close();
                });
            }

            this.$dialog.on('click', '.js-abook-person-name', function() {
                metrika('Клики', 'Имя');

                var headerContentClass = 'b-mail-card__header__content';
                var $content = $(this).closest('.' + headerContentClass);

                if ($content.hasClass(headerContentClass + '_editable') && !$content.hasClass(headerContentClass + '_edit')) {
                    $content.addClass(headerContentClass + '_edit');
                    $content.find('input').eq(0).focus();
                }
            });

            this.$dialog.on('keyup', '.js-abook-person-input', function(e) {
                var nbInput = nb.block(e.currentTarget);
                var newValue = nbInput.getValue();

                if (nbInput.error && nbInput.prevValue !== newValue) {
                    setTimeout(function() {
                        /**
                         * Проверка нужна для случая, когда пользователь вводит несколько символов и
                         * тут же нажимает Enter. Enter срабатывает на keydown и получается, что события
                         * от нажатия последних клавишь приходят уже после обработки валидации.
                         * @see https://jira.yandex-team.ru/browse/DARIA-35277
                         */
                        if (!nbInput.cancelHideError || new Date().getTime() - nbInput.cancelHideError > 200) {
                            nbInput.hideError();
                        }
                        nbInput.cancelHideError = false;
                    }, 100);
                }
                nbInput.prevValue = newValue;
            });

            this.$dialog.on('submit', 'form', function(e) {
                e.preventDefault();

                /**
                 * Если нету кнопки сохранения, то это сохранение карточки организации.
                 */
                if (that.nbSaveButton) {
                    if (that.nbSaveButton.isEnabled() && that.validate()) {
                        that.save();
                        that.haveOtherChanges = false;

                        that.nbSaveButton.disable();
                    }
                } else {
                    that.save();
                }
            });
        },

        /**
         * Вставляет дни, месяцы и годы в селекты для дня рождения сохраняя текущее значение.
         */
        initDate: function() {
            var $birthdayContainer = this.$dialog.find('.js-abook-birthday-container');
            if (!$birthdayContainer.length) {
                return;
            }

            this.nbSelectBDay = nb.$block('.js-abook-select-day', $birthdayContainer);
            this.nbSelectBMonth = nb.$block('.js-abook-select-month', $birthdayContainer);
            this.nbSelectBYear = nb.$block('.js-abook-select-year', $birthdayContainer);

            var bdDay = $birthdayContainer.data('day');
            var bdMonth = $birthdayContainer.data('month');
            var bdYear = $birthdayContainer.data('year');

            var dayOptions = [];
            var monthOptions = [];
            var yearOptions = [];

            for (var day = 1; day <= 31; ++day) {
                dayOptions.push({
                    value: day,
                    text: day,
                    selected: day === bdDay
                });
            }

            for (var month = 1; month < 13; ++month) {
                monthOptions.push({
                    value: month,
                    text: i18n('%Months', month - 1),
                    selected: month === bdMonth
                });
            }

            var currentYear = new Date().getFullYear();
            for (var year = LOVER_BIRTH_YEAR; year <= currentYear; ++year) {
                yearOptions.push({
                    value: year,
                    text: year,
                    selected: year === bdYear
                });
            }

            this.nbSelectBDay.setSource(dayOptions);
            this.nbSelectBMonth.setSource(monthOptions);
            this.nbSelectBYear.setSource(yearOptions);
        },

        /**
         * Валидирует и подсвечивает невалидные поля.
         * @return {boolean}
         */
        validate: function() {
            var that = this;
            var isGlobalValid = true;
            var firstFailInput = null;
            var atLeastOneValidEmail = false;

            var $scrollContainer = this.$dialog.find('.js-abook-contact');

            this.$dialog.find('.js-abook-person-email, .js-abook-person-phone').each(function() {
                var input = nb.block(this);
                // FIXME: Spike for miss error-widget
                if ('error' in input) {
                    input.error = input.error || nb.find(input.data.error.id);
                }

                var field = $(this).is('.js-abook-person-email') ? 'email' : 'phone';
                var value = input.getValue();

                if (value) {
                    if (that._validateField(value, field)) {
                        if (field === 'email') {
                            atLeastOneValidEmail = true;
                        }
                        input.hideError();
                    } else {
                        input.showError({
                            appendTo: $scrollContainer
                        });
                        input.cancelHideError = new Date().getTime();

                        if (!firstFailInput) {
                            firstFailInput = input;
                        }
                        isGlobalValid = false;
                    }
                } else {
                    input.hideError();
                }
            });

            if (!firstFailInput && !atLeastOneValidEmail && this.params.owner !== 'message') {
                firstFailInput = nb.block(this.$dialog.find('.js-abook-person-email:first').get(0));
            }

            if (firstFailInput) {
                isGlobalValid = false;
                // FIXME: Должно быть firstFailInput.focus()
                firstFailInput.$node.focus();
                setTimeout($.fn.focus.bind(firstFailInput.$node), 200);
            }

            return isGlobalValid;
        },

        _validateField: function(value, field) {
            if (field === 'email') {
                return Jane.FormValidation.checkEmail(value);
            } else {
                return (/^[\d\s+#*()-]*$/).test(value);
            }
        },

        openDialog: function() {
            var dialogOptions = {
                body: this.$dialog,
                width: DIALOG_WIDTH,
                easyclose: true,
                onopen: this.onOpenDialog.bind(this),
                onclose: this.onCloseDialog.bind(this)
            };

            this.onbeforeopen(dialogOptions);

            Daria.Dialog.open(dialogOptions);
        },

        onOpenDialog: function() {
            metrika('Показ');

            var $nameInputs = this.$dialog.find('input[name$="name"]');

            if ($nameInputs.length) {
                var name = '';
                $nameInputs.each(function() {
                    name += $(this).val();
                });

                if (!name) {
                    $nameInputs.eq(0).focus();
                }
            }

            this.fillHeight_IE8();
        },

        /**
         * Имплементация CSS2: max-height правила для старых браузеров.
         */
        fillHeight_IE8: function() {
            if (Modernizr.ielt9) {
                var $scrollbox = this.$dialog.find('.abook-person-scrollbox');
                var contentHeight = $scrollbox.find('.b-mail-card__column:eq(0)').height();

                $scrollbox.height(Math.min(contentHeight + 1, CONTENT_MAX_HEIGHT_IE));

                Daria.Dialog.position();
            }
        },

        onCloseDialog: function() {
            Jane.events.unbind('form-cacher.changed', this.onFormDirty);
            Jane.events.unbind('form-cacher.unchanged', this.onFormNormal);
        },

        save: function() {
            metrika('Клики', 'Сохранить изменения');

            var that = this;
            var form = this.$dialog.find('form');
            var type = Daria.parseQuery(form.attr('data-params')).type;
            var params = form.serializeObject();
            var doHandler = (type === 'add' ? 'do-abook-person-add' : 'do-abook-person-update');
            var handlers = [doHandler, 'abook-contact'];

            // если пользователь не менял дату, то её не нужно сохранять
            if (params.b_day === '1' && params.b_month1 === '1' && params.b_year == '1900') {
                delete params.b_day;
                delete params.b_month1;
                delete params.b_year;
            }

            params.mail_addr = [].concat(params.mail_addr);
            params.mail_addr = params.mail_addr.filter(skipEmpty);
            params.email = params.mail_addr;

            params.tel_list = [].concat(params.tel_list);
            params.tel_list = params.tel_list.filter(skipEmpty);
            params.phone = params.tel_list;

            // person_id для do-abook-person, cid для abook-contacts
            params.cid = params.person_id = this.cid;
            params.timeout = 'yes';

            if (type === 'add' && Daria.Page.params.tid) {
                params.tags = [Daria.Page.params.tid];
            }

            Jane.$H('abook-contact').clearCache();

            var queue = $.Deferred();
            queue.resolve();

            $.each(this.removeLabels, function(mcid, tids) {
                queue = queue.then(function() {
                    return Jane.$H('abook-groups').removeFromGroup({
                        mcids: [mcid],
                        tids: tids
                    }, true);
                });
            });

            queue.always(function() {
                Jane.Handler.doAll(handlers, params, function(data) {
                    var cid = jpath(data, '.handlers[0].data.cid')[0];

                    if (cid) {
                        var newContactCache = jpath(data, '.handlers[1].data.contact')[0];
                        metrikaOnSave(that.contactCache || {}, newContactCache || {});
                        that.contactCache = newContactCache;

                        Jane.$H('abook-letters').clearCache();
                        Jane.$H('abook-groups').clearCache();
                        Jane.$H('abook-contacts').clearCache();

                        Daria.Autocompleter.getContact().flushCache();

                        if (type === 'add' && that.onadd) {
                            that.onadd(cid);
                        } else {
                            Jane.$B('app').run();
                            that.updateState();
                        }
                        Daria.Statusline.showMsg({
                            body: i18n('%АК_Изменения_Сохранены'),
                            body3: i18n('%АК_Изменения_Сохранены')
                        });
                    } else {
                        Daria.Statusline.showMsg({
                            body: i18n('%АК_фэйл'),
                            body3: i18n('%3pane_АК_фэйл')
                        });
                    }
                });
            });
        },

        updateState: function() {
            var that = this;

            var fields = [{
                type: 'phone',
                nbInput: this.nbNewPhone,
                $node: this.$dialog.find('.js-abook-person-new-phone').closest('.js-abook-card-field')
            }];

            if (this.params.owner === 'message') {
                var nbHeaderSave = nb.$block('.js-abook-person-header-save', this.$dialog);
                nbHeaderSave.disable();
            } else {
                fields.push({
                    type: 'email',
                    nbInput: this.nbNewEmail,
                    $node: this.$dialog.find('.js-abook-person-new-email').closest('.js-abook-card-field')
                });
            }

            fields.forEach(function(field) {
                var newValue = field.nbInput.getValue().trim();
                if (newValue) {
                    var $savedField = $(Jane.tt('mail-abook:abook-person-input', { value: newValue, field: field.type }));
                    field.nbInput.setValue('');
                    $savedField.insertBefore(field.$node);

                    nb.init($savedField);
                    that.formCacher.addControl($savedField.find('.js-abook-person-input').get(0));
                }
            });

            that.formCacher.applyChanges();

            that.fillHeight_IE8();
        },

        /**
         * Удаление контакта.
         */
        removeContact: function() {
            metrika('Клики', 'Удалить контакт');

            Jane.$H('abook-contacts').removeContacts([this.cid])
                .done(Daria.Dialog.close.bind(Daria.Dialog));
        },

        removeEmail: function(e) {
            e.stopPropagation();
            var $target = $(e.currentTarget);

            $target.closest('.js-abook-card-field').remove();

            this.haveOtherChanges = true;
            this.nbSaveButton.enable();
        },

        removePhone: function(e) {
            e.stopPropagation();
            var $target = $(e.currentTarget);

            $target.closest('.b-mail-input').remove();

            this.haveOtherChanges = true;
            this.nbSaveButton.enable();
        },

        removeLabel: function(o) {
            o.stopPropagation();

            var $label = $(o.currentTarget).closest('.js-abook-label');

            var mcid = this.cid + '.' + $label.data('mid');
            this.removeLabels[mcid] = this.removeLabels[mcid] || [];
            this.removeLabels[mcid].push($label.data('tid'));
            $label.remove();

            this.haveOtherChanges = true;
            this.nbSaveButton.enable();
        },

        /**
         * Вызывается перед открытием попапа.
         * @param {Object} options
         */
        onbeforeopen: function(options) {
            /* jshint unused: false */
        },
        /* ----------------------------------------------------------------- */

        /**
         * Хэндлеры, которые нужно запросить, чтобы отобразить карточку.
         * @return {Array}
         */
        getHandlers: function() {
            return [];
        },

        /**
         * Исходя из переданных параметров экшена создаёт параметры для запроса хэндлеров.
         * @return {Object}
         */
        getParams: function() {
            return {};
        },

        /**
         * Исхода из переданных параметров экшена создаёд JSON для Jane tt.
         * @return {Object}
         */
        getJSON: function() {
            var that = this;
            var yateParams = {
                owner: that.params.owner
            };

            this.jsonFields.forEach(function(prop) {
                if (prop in that.params) {
                    yateParams[prop] = that.params[prop];
                }
            });

            return yateParams;
        }
    };

    /**
     * Записывает метрику опираясь на сравнение данных.
     * @param {Object} prev
     * @param {Object} current
     */
    function metrikaOnSave(prev, current) {
        if (!prev.description && current.description) {
            metrika('Добавление комментария');
        }

        var emailCount = (prev.email ? prev.email.length : 0);
        var newEmailCount = (Array.isArray(current.email) ? current.email.length : 0);
        if (emailCount < newEmailCount) {
            metrika('Добавление адреса');
        }

        var phoneCount = (prev.phone ? prev.phone.length : 0);
        var newPhoneCount = (Array.isArray(current.phone) ? current.phone.length : 0);
        if (phoneCount < newPhoneCount) {
            metrika('Добавление телефона');
        }

        if (!('birthdate' in prev) && 'birthdate' in current) {
            metrika('Добавление даты рождения');
        }
    }

    /* --------------------------------------------------------------------- */

    /**
     * Переопределяем необходимые методы для конкретных типов попапов.
     */
    var popups = {
        /**
         * Для абука (добавление/редактирование) контакта.
         */
        abook: {
            jsonFields: ['cid', 'avatar'],
            getHandlers: function() {
                return this.params.cid ? ['abook-contact'] : [];
            },
            getParams: function() {
                return { cid: this.params.cid };
            },
            onadd: function(cid) {
                Jane.Handler.getAll(['abook-contact', 'abook-letters'], { cid: cid }, function() {
                    Daria.Dialog.close();

                    if (Daria.Page.params.tid) {
                        Jane.$B('app').run();
                    } else {
                        var abookFlags = { onlyFirstEmail: true, joinName: true };
                        var info = Jane.$H('abook-contact').getContactInfo(cid, abookFlags);
                        var letter = (info.name || info.email).charAt(0).toUpperCase();
                        Daria.Page.go('#contacts/all/' + letter);
                    }
                });
            }
        },

        /**
         * Для правой колонки (просмотр и добавление контакта).
         */
        message: {
            jsonFields: ['email', 'name', 'mid', 'is-contact', 'avatar-type', 'login'],
            getHandlers: function() {
                return ['abook-contact', 'social-profiles', 'company-info', 'settings', 'staff-info', 'message'];
            },
            onbeforeopen: function(options) {
                if (Daria.layout == '2pane') {
                    var offset = this.params.$openTarget.find('.b-message-head__field__title').offset();
                    options.onTarget = {
                        x: offset.left - 15,
                        y: offset.top + 11 - $(window).scrollTop(),
                        side: 'left',
                        pos: 'top',
                        needTail: false
                    };
                }

                var node = options.body.find('.b-mail-card__header__avatar')[0];
                Daria.SocialAvatarsAbookPopup(node);
            },
            getParams: function() {
                var params = {
                    email: this.params.email,
                    refs: this.params.refs,
                    timeout: 'yes',
                    ids: this.params.mid || Daria.Page.params.ids
                };

                if (this.params.url) {
                    params.url = this.params.url;
                    params.region = this.params.region;
                }

                if (this.params.login) {
                    params.login = this.params.login;
                }

                return params;
            }
        },

        /**
         * Для композа (добавление контакта).
         */
        compose: {
            jsonFields: ['email', 'name'],
            getHandlers: function() {
                return [];
            },
            getParams: function() {
                return {
                    email: this.params.email,
                    timeout: 'yes'
                };
            }
        },

        staff: {
            jsonFields: ['login', 'email', 'mid'],
            getHandlers: function() {
                return ['staff-info'];
            },
            getParams: function() {
                return { login: this.params.login };
            }
        }
    };
    var PopupTypes = {};

    $.each(popups, function(popupName) {
        var Popup = function Person() {};
        Popup.prototype = $.extend({}, base, popups[popupName]);

        PopupTypes[popupName] = Popup;
    });

    function skipEmpty(obj) {
        return !!obj;
    }

    Daria.Abook.PersonPopup = {
        /**
         * Открывает карточку контакта нужного типа.
         * @param {Object} params
         * @param {Object} event
         */
        open: function(params, event) {
            var popupParams = $.extend({ owner: 'abook' }, params);

            var popup = new PopupTypes[popupParams.owner]();
            popup.open(popupParams, event);
        }
    };


    /**
     * Хелперы для метрики.
     */

    function metrika() {
        if (Daria.Page.type === 'contacts') {
            Jane.Block.Abook.Metrika.c.apply(null, ['Карточка контакта'].concat($.makeArray(arguments)));
        }
    }
    /* --------------------------------------------------------------------- */
})();

/* ../../js/components/abook.person.js end */


    /* ../../actions/abook-actions.js begin */
/* ../../actions/abook/abook.js begin */

(function() {
    /* ------------------------------------------------------------------------- */

    /**
     * Экшены для тулбара
     */

    Actions.create('abook.remove-contacts', function(o) {
        Daria.Dialog.close();

        if (o && o.event && $(o.event.currentTarget).closest('.block-toolbar').length) {
            Jane.Block.Abook.Metrika.c('Тулбар', 'Клик Удалить контакт');
        }

        var selectedContacts = Jane.Block.Abook.getSelected();
        Jane.$H('abook-contacts').removeContacts(selectedContacts);
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.remove-contacts-from-group', function(o) {
        if (o && o.event && $(o.event.currentTarget).closest('.block-toolbar').length) {
            Jane.Block.Abook.Metrika.c('Тулбар', 'Клик Удалить из группы');
        }

        var tid = Daria.Page.params.tid;
        if (tid) {
            Daria.Dialog.close();

            var selected = Jane.Block.Abook.getSelected();
            Jane.$H('abook-groups').removeFromGroup({ tids: [tid], mcids: selected }).then(function() {
                Jane.$B('app').run();
            });
        }
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.toolbar-more-actions', function(o) {
        if (o && o.event && $(o.event.currentTarget).closest('.block-toolbar').length) {
            Jane.Block.Abook.Metrika.c('Тулбар', 'Клик Ещё');
        }

        var $node = $(Jane.tt('mail-abook:abook-extra-actions'));
        Daria.Dropdown.toggle(null, {
            dropdown: $node,
            content: $node,
            handle: $(o.event.currentTarget)
        });
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.groups-dropdown', function(o) {
        Daria.Dialog.close();

        if (o && o.event && $(o.event.currentTarget).closest('.block-toolbar').length) {
            Jane.Block.Abook.Metrika.c('Тулбар', 'Клик Добавить в группу');
        }

        var $button = $(o.event.currentTarget);
        var $groupList = $(Jane.tt('mail-abook:abook-groups-dropdown', {}, ['abook-groups']));

        Daria.Dropdown.toggle(null, {
            handle: $button,
            dropdown: $groupList,
            content: $groupList
        });
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.assign-group', function(o) {
        var bAbookContacts = Jane.Block.Abook.getContactsBlock();

        var selected = Jane.Block.Abook.getSelected();

        var $dropDownTarget = $(o.params.dropdownTarget);
        var tid = o.params.tid;

        var selectedObj = bAbookContacts.getSelectedWithMcids();

        var allContactsWithOneEmail = true;
        var selectedMcids = [];
        $.each(selectedObj, function(cid, mcids) {
            if (mcids.length > 1) {
                allContactsWithOneEmail = false;
            }

            if (mcids.length) {
                selectedMcids = selectedMcids.concat(mcids);
            } else {
                selectedMcids.push(cid);
            }
        });

        // Показываем дропдаун выбора емейла только в случае одного контакта.
        if (selected.length === 1 && selectedMcids.length > 1) {
            if ($dropDownTarget.length) {
                var cid = selected[0];
                var emails = Jane.$H('abook-contacts').getContactData(cid).email;

                Block.Abook.showDropPopup($dropDownTarget, {
                    cid: cid,
                    emails: emails,
                    tid: Daria.Page.params.tid,
                    targetTid: tid,
                    additionalClass: 'abook-group-drop-popup-content_side-menu'
                });
            } else {
                Jane.Actions.run('abook-add-to-group.s', tid);
            }
        } else if (selected.length > 1 && !allContactsWithOneEmail) {
            Jane.Actions.run('abook-add-to-group.s', tid);
        } else {
            Jane.$H('abook-groups').addToGroup({ tid: tid, mcids: selectedMcids }).then(function() {
                Jane.$B('app').run();
            });
        }
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.add-to-phone', function() {
        var selected = Jane.Block.Abook.getSelected();

        Jane.$H('abook-groups').addToGroup({ tid: -10, mcids: selected }).then(function() {
            Jane.$B('app').run();
        });
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.write-to-email', function(o) {
        var cid = o.params.cid;
        var mid = o.params.mid;

        var contact = Jane.$H('abook-contacts').getContactData(cid);
        var email = jpath(contact.email, '[.id == "' + mid + '"].value')[0];

        Daria.composeParams = {
            to: Jane.FormValidation.obj2contact({
                name: contact.name.full,
                email: email
            })
        };
        Daria.Page.go('#compose');
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.export', function(o) {
        if (o && o.event && $(o.event.currentTarget).closest('.js-abook-toolbar-dropdown').length) {
            Jane.Block.Abook.Metrika.c('Тулбар', 'Клик Ещё', 'Клик Сохранить контакты в файл');
        }

        var form = Jane.tt('mail-abook:abook-export');

        function submit() {
            form.submit();
            Daria.Dialog.close();
        }

        Daria.Dialog.open({
            title: i18n('%АК_Экспорт'),
            body: form,
            buttons: [
                { name: 'submit', value: i18n('%АК_Экспорт_ОК'), onclick: submit },
                { name: 'cancel' }
            ]
        });
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.import', function(o) {
        if (o && o.event && $(o.event.currentTarget).closest('.js-abook-toolbar-dropdown').length) {
            Jane.Block.Abook.Metrika.c('Тулбар', 'Клик Ещё', 'Клик Добавить контакты из файла');
        }

        var form = Jane.tt('mail-abook:abook-import');
        var $form = $(form);
        var filename = '';

        Daria.Dialog.open({
            title: i18n('%АК_Импорт'),
            body: form,
            buttons: [
                {
                    name: 'submit',
                    value: i18n('%АК_Экспорт_ОК'),
                    onclick: onSubmit
                },
                {
                    name: 'cancel'
                }
            ],
            onopen: function() {
                var $titleWrapper = $form.find('.b-message-attachments__file_deletable');
                var $inputWrapper = $form.find('.b-input-file');

                $form.append($('<input>').attr('type', 'hidden').attr('name', '_ckey').val(Daria.Page.ckey));

                $form.on('change', 'input[type="file"]', function() {
                    filename = $(this).val().replace(/C:\\fakepath\\/i, '');
                    $form.find('.b-message-attachments__file-name').text(filename);

                    $titleWrapper.removeClass('g-hidden');
                    $inputWrapper.addClass('g-hidden');

                    Daria.Dialog.enableButton('submit');
                });

                $form.on('click', '.b-message-attachments__file__delete', function() {
                    $form.resetForm();
                    // BUGFIX: IE и Chrome не тригерят "change" если снова выбран тот же файл
                    var $file = $form.find('input[type="file"]');
                    $file.replaceWith($file.clone());
                    $titleWrapper.addClass('g-hidden');
                    $inputWrapper.removeClass('g-hidden');
                    Daria.Dialog.disableButton('submit');
                });

                Daria.Dialog.disableButton('submit');
            },
            onclose: function() {
                // Отмена закачки - удаляем iframe, созданный jQueryForm (DARIA-8977)
                $('iframe[name^="jqFormIO"]').remove();
            }
        });

        function onSubmit() {
            Daria.Dialog.disableButton('submit');
            $form.find('.b-load-message_abook-file-select').addClass('g-hidden');
            $form.find('.b-load-message_abook-import').removeClass('g-hidden');

            $form.ajaxSubmit({
                iframe: true,
                dataType: 'json',
                success: function(data) {
                    var error = !data || data.error || data.result.saved === 0;
                    if (error) {
                        onUploadError();
                    } else {
                        $form.find('.b-load-message_abook-import').addClass('g-hidden');
                        $form.find('.b-load-message_abook-success').removeClass('g-hidden');

                        var htmlMsg = i18n('%АК_Импорт_успешен', _.escape(filename));
                        $form.find('.b-load-message_abook-success-message').html(htmlMsg);

                        onUploadFinish();

                        // Обновляем контакты
                        Jane.$H('abook-contacts').clearCache();
                        Jane.$H('abook-letters').clearCache();
                        Jane.$H('abook-groups').clearCache();
                        Daria.Autocompleter.getContact().flushCache();

                        Jane.$B('app').run();
                    }
                },
                error: onUploadError
            });
        }

        function onUploadFinish() {
            Daria.Dialog.toggleButton('submit', false);
            Daria.Dialog.setButtonText('cancel', i18n('%АК_Импорт_вернуться'));
        }

        function onUploadError() {
            $form.find('.b-load-message_abook-import').addClass('g-hidden');
            $form.find('.b-load-message_abook-fail').removeClass('g-hidden');
            onUploadFinish();
        }
    });

    /* ------------------------------------------------------------------------- */

    /**
     * Иниализирует и открывает попап группы
     * @param {string} type
     * @param {string} [popupClass]
     * @param {string} [tid]
     * @param {string} [targetTid]
     */
    function openGroupDialog(type, popupClass, tid, targetTid) {
        var params = {
            tid: tid,
            _page: 'contacts',
            type: type,
            selectedCids: Jane.Block.Abook.getSelected()
        };

        if (targetTid !== undefined) {
            params.targetTid = targetTid;
        }

        var bAbook = Jane.Block.make('abook', params);

        bAbook.run(params, function() {
            Daria.Dialog.open({
                width: 810,
                additionalClass: popupClass || '',
                body: this.block.getCacheNode(),
                onclose: function() {
                    bAbook.destroy();
                }
            });
        });
    }

    /* ------------------------------------------------------------------------- */

    Actions.create('abook-new-group.show', function(o) {
        if (o && o.event) {
            var $button = $(o.event.currentTarget);
            if ($button.closest('.js-abook-groups-teaser').length) {
                Jane.Block.Abook.Metrika.c('Левая колонка', 'Промо групп', 'Клик Создать группу');
            } else if ($button.closest('.abook-new-group').length) {
                Jane.Block.Abook.Metrika.c('Левая колонка', 'Группы', 'Клик Новая группа');
            }
        }

        openGroupDialog('new-group', 'abook-new-group-popup');
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook-add-to-group.s', function(params) {
        openGroupDialog('add-to-group', 'abook-add-to-group-popup', Daria.Page.params.tid, params.params);
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.choose-email-and-assign', function(o) {
        var $button = $(o.event.target);
        var $dialog = $button.parent();

        var mcids = [];

        var $checked = $dialog.find('.js-abook-popup-contact:has(:checked)');
        $checked.each(function() {
            mcids.push($(this).data('mcid'));
        });

        Daria.Dialog.close();
        Jane.$H('abook-groups').addToGroup({ tid: o.params.tid, mcids: mcids })
            .then(function() {
                Jane.$B('app').run();
            });
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.change-field', function(e) {
        var $field = $(e.event.currentTarget);
        var $dropdown = $field.closest('.js-abook-field-dropdown-container');
        var $contact = $($dropdown.data('contact'));
        var $entries = $contact.closest('.abook-entries');
        var bEntries = Jane.Block.getInstance($entries, 'abook-entries-select');

        $(document).trigger('b-mail-dropdown-closeall');
        $contact.data('field', $field.data('field'));

        bEntries.addToModel($contact);
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.show-report', function(o) {
        Jane.Block.make('abook-report', {
            $parent: Daria.Dialog.$dialog,
            $closer: $(o.event.target)
        }).open();
    });

    /* ------------------------------------------------------------------------- */

    Actions.create('abook.noactive-add-compose', function() {
        Daria.Statusline.showMsg({
            body: i18n('%Compose_50_email_addr_reached'),
            body3: i18n('%Compose_50_email_addr_reached')
        });
    });

    /* ------------------------------------------------------------------------- */

    // TODO: Заменить
    Actions.create('abook.group-add', function() {
        throw new Error('Old Group Popup');

        //Group.openSimple(o);
    });

    /* ------------------------------------------------------------------------- */
})();

/* ../../actions/abook/abook.js end */


/* ../../actions/abook-actions.js end */

    /* ../../blocks/abook-blocks.js begin */
/* ../../blocks/abook-left/abook-left.js begin */
/* ------------------------------------------------------------------------------------------------------------- */

(function() {
	Jane.Block.create('abook-left', {
		blocks: ['abook-groups'],
		params: { tid: null, q: null }
	});
})();

/* ------------------------------------------------------------------------------------------------------------- */

/* ../../blocks/abook-left/abook-left.js end */

/* ../../blocks/abook-groups/abook-groups.js begin */
(function(Jane, Daria) {
    var bAbookGroups = Jane.Block.create('abook-groups', {
        handlers: ['abook-groups'],
        events: {
            'click .js-abook-write-group': 'writeToGroup',

            'click .b-folders__folder__link': 'allClickMetrika',
            'click .abook-group': 'groupClickMetrika',
            'click .abook-new-group-settings': 'settingsClickMetrika'
        }
    });

    var bAbookGroupsProto = bAbookGroups.prototype;

    bAbookGroupsProto.onprepare = function(params) {
        params.extended = 'no';
        return true;
    };

    bAbookGroupsProto.onhtmlinit = function(node) {
        this.$node = $(node);

        metrika_Show(this.$node);
    };

    bAbookGroupsProto.onshow = function() {
        this.bindGroupsDragDrop();
    };

    bAbookGroupsProto.onhide = function() {
        this.unbindGroupsDragDrop();
    };

    /**
     * Запрашивает все емейлы группы и переходит к показу композа.
     * @param {Object} e объект-ивент jquery
     */
    bAbookGroupsProto.writeToGroup = function(e) {
        e.preventDefault();
        e.stopPropagation();

        Block.Abook.Metrika.c('Левая колонка', 'Группы', 'Клик Написать');

        var $el = $(e.target);
        var params = { tid: $el.data('tid') };

        Jane.Handler.getAll(['abook-contacts'], params, function() {
            var emails = Jane.$H('abook-contacts').getContactsEmails(params, true);
            goToCompose(emails);
        });
    };

    /**
     * Инициализирует драг групп и дроп на контакты.
     */
    bAbookGroupsProto.bindGroupsDragDrop = function() {
        if (Modernizr.ielt9) {
            return;
        }

        var dragParams = Block.Abook.makeDraggableParams({
            helper: createDragHelper,
            start: dragStart
        });

        var dropParams = Block.Abook.makeDroppableParams({
            drop: this.onDropContact,
            accept: '.abook-entry'
        });

        this.$dragDropGroups = this.$node.find('.abook-group').not('.abook-group_current')
            .draggable(dragParams)
            .droppable(dropParams);

        this.isDragDropInit = true;
    };

    /**
     * Уничтожение драг групп и дроп на контакты.
     */
    bAbookGroupsProto.unbindGroupsDragDrop = function() {
        // TODO: Убрать "this.isDragDropInit" когда починится баг DARIA-33834
        if (this.$dragDropGroups && this.isDragDropInit) {
            // Иногда, при неведомых обстоятельствах, падает
            try {
                this.$dragDropGroups
                    .draggable('destroy')
                    .droppable('destroy');
            } catch(e) {}

            this.isDragDropInit = false;
        }
    };

    /**
     * Функция-обработчик дропа на группу.
     * @param {Object} e объект-ивент jQuery дропа
     */
    bAbookGroupsProto.onDropContact = function(e/*, helper*/) {
        var tid = Number($(e.target).data('tid'));

        if (tid === -10) {
            Jane.Actions.run('abook.add-to-phone');
        } else {
            var params = {
                tid: tid,
                dropdownTarget: e.target
            };
            Jane.Actions.run('abook.assign-group', params);
        }
    };

    /**
     * Открывает композ с заполненым полем "Кому".
     * @param {Object} emails Объект с ключами cid и данными: { 'mymail@mail.ru': 'hash', ... }
     */
    function goToCompose(emails) {
        var to = [];

        $.map(emails, function(emailHash) {
            $.map(emailHash, function(_, key) {
                to.push(key);
            });
        });

        Daria.composeParams = { to: to.join(', ') };
        Daria.Page.go('#compose');
    }

    /**
     * Инициализирует ноду-хелпер, которая появляется при перетаскивании.
     * @param {Object} e объект-ивент драга группы
     * @return {Node} нода хелпера
     */
    function createDragHelper(e) {
        var name = $(e.target).closest('.abook-group').find('.abook-group-name').text();

        return Jane.tt('mail-abook:drag-helper', { group: name });
    }

    /**
     * Функция-инициализатор начала драга группы.
     * Анчекает все ноды, очищает массив сидов.
     */
    function dragStart() {
        Jane.Block.Abook.getContactsBlock().deselectAll();
        Daria.Dialog.close();
    }


    /**
     * Хелперы для метрики.
     */

    function metrika_Show($node) {
        if (!Jane.watcher.get('metrika:ak:showed')) {
            var contactsCount = Jane.$H('abook-groups').getCacheByPageParams()['contacts-total-count'];
            Jane.Block.Abook.Metrika.c('Показы страницы', (contactsCount > 0 ? 'Есть контакты' : 'Нет контактов'));

            if ($node.find('.b-teaser').length) {
                Jane.Block.Abook.Metrika.c('Левая колонка', 'Промо групп', 'Показ');
            }

            Jane.watcher.set('metrika:ak:showed', true);
        }
    }

    bAbookGroupsProto.allClickMetrika = function() {
        Jane.Block.Abook.Metrika.c('Левая колонка', 'Клик Все контакты');
    };

    bAbookGroupsProto.groupClickMetrika = function() {
        Jane.Block.Abook.Metrika.c('Левая колонка', 'Группы', 'Клик по группе');
    };

    bAbookGroupsProto.settingsClickMetrika = function() {
        Jane.Block.Abook.Metrika.c('Левая колонка', 'Группы', 'Клик по шестерёнке Настроек');
    };

})(Jane, Daria);

/* ../../blocks/abook-groups/abook-groups.js end */

/* ../../blocks/abook/abook.js begin */
(function(Jane, Daria) {

    var KEYCODE_ENTER = 13;

    var bAbook = Jane.Block.create('abook', {
        handlers: {
            'company-info': true
        },
        blocks: ['abook-new-group-panel-box', 'abook-head-box', 'abook-contacts-box'],
        events: {
            'keydown .js-abook-head-search': 'preventReturn',
            'keyup .js-abook-head-search': 'queryChanged',
            'blur .js-abook-head-search': 'metrikaSearch'
        }
    });

    Block.Abook = bAbook;

    var bAbookProto = bAbook.prototype;

    bAbookProto.toshow = function(params) {
        /**
         * Сохраняем инстанс АК.
         * Jane.watcher.set('abook-normal-instance', this);
         * Jane.watcher.set('abook-select-instance', this);
         * Jane.watcher.set('abook-new-group-instance', this);
         * Jane.watcher.set('abook-add-to-group-instance', this);
         */
        Jane.watcher.set('abook-' + params.type + '-instance', this);
        return true;
    };

    bAbookProto.onhtmlinit = function(node, params) {
        this.searchLazy = this.search.lazy(200);

        this.isPopup =
            params.type === 'select' ||
            params.type === 'new-group' ||
            params.type === 'add-to-group';

        this.$node = $(node);
        this.$input = this.$node.find('.js-abook-head-search');
    };

    bAbookProto.onrepaint = function(params) {
        if (params.q) {
            if (this.$input.val() === '' ||                 // Первая инициализация блока.
                params.q.length === 1 || params.q === '0-9' // Переход на фильтр из алфавита.
            ) {
                this.$input.val(params.q);
            }
        } else {
            this.$input.val('');
        }
    };

    bAbookProto.onhide = function() {
        this.searchLazy.reset();
    };

    bAbookProto.onhtmldestroy = function() {
        this.searchLazy.reset();
    };

    bAbookProto.queryChanged = function() {
        var q = this.$input.val();

        var prevQuery = (this.isPopup ? this.q : Daria.Page.params.q) || '';
        if (q.toLowerCase() !== prevQuery.toLowerCase()) {
            this.searchLazy(q);
        }
    };

    bAbookProto.search = function(q) {
        if (this.isPopup) {
            this.q = q;
            this.run($.extend({ q: q }, this.params));
        } else {
            var params = Daria.Page.params;

            params.q = q;

            this.run();

            var url = '#' + params._page;
            url += params.tid ? '/group' + params.tid : '/all';
            url += params.q ? '/' + params.q : '';

            Daria.hashReplace(url);
        }
        this.needLogSearching = true;
    };

    bAbookProto.metrikaSearch = function() {
        if (!this.isPopup && this.needLogSearching) {
            this.needLogSearching = false;
            bAbook.Metrika.c('Тулбар', 'Поиск (поискали поиском)');
        }
    };

    /**
     * Фикс для IE9.
     * В IE9 вызывает клик по следующей кнопке по нажатию Enter в инпуте.
     * Причем не важно, где эта кнопка находится в иерархии узлов (выше-ниже).
     * @see http://jsfiddle.net/J2HM3/
     */
    bAbookProto.preventReturn = function(e) {
        if (e.which === KEYCODE_ENTER) {
            e.preventDefault();
        }
    };

    bAbookProto.getContactsBlock = function() {
        return this.getBlockByName('abook-contacts-box').getActive();
    };


    /*************************************************************************
     * Расширение методами для попапов выбора емейлов и создания группы.
     *
     *************************************************************************/

    bAbookProto.getSharedInstance = function() {
        this.sharedObject = this.sharedObject || { inited: false };
        return this.sharedObject;
    };

    /**
     * Смена фильтра групп.
     * @param {string} tid
     */
    bAbookProto.changeGroup = function(tid) {
        this.run($.extend({ }, this.params, { tid: tid }));
    };


    /*************************************************************************
     * Расширение статическими методами.
     *
     *************************************************************************/

    /**
     * Открывает попап с имейлами, которые можно выбрать для добавления в группу.
     * @param {Object} $node нода, из которой должен выпасть попап
     * @param {Object} params параметры, в которых содержится сид, имейлы, тид
     *   @param {string|number} params.tid
     *   @param {string|number} params.cid
     *   @param {string} [params.type] может быть 'list'
     */
    bAbook.showDropPopup = function($node, params) {
        var tid = Number(params.tid);
        var cid = params.cid;
        var $target = $node.find('.js-abook-popup-handle');
        if (!$target.length) {
            $target = $node;
        }

        var emailsData = Jane.$H('abook-contacts').getContactData(cid).email;
        // Если нету группы или группа -10, то берем все емейлы.
        if (tid && tid !== -10) {
            emailsData = emailsData.filter(function(emailData) {
                return emailData.tags.indexOf(tid) !== -1;
            });
        }

        var $content = $('<div>').addClass('b-mail-dropdown__box__content').addClass(params.additionalClass);

        if (params.type === 'list') {
            $content.html(Jane.tt('mail-abook:abook-list-email-popup', {
                cid: cid,
                emails: emailsData
            }));
        } else {
            $content.html(Jane.tt('mail-abook:abook-choose-email-popup', {
                cid: cid,
                emails: emailsData,
                targetTid: params.targetTid
            }));
        }

        Daria.Dropdown.toggle(null, {
            dropdown: $content,
            content: $content,
            handle: $target
        });
    };

    /**
     * Создает параметры драга на основе базовых.
     * @param {Object} params объект с параметрами, которые должны дополнить или переписать дефолтные параметры
     * @return {Object} объект с новыми параметрами
     */
    bAbook.makeDraggableParams = function(params) {
        var defaultParams = {
            appendTo: '.b-layout',
            delay: 100,
            distance: 10,
            cursor: 'pointer',
            cursorAt: {
                top: 0,
                left: 0
            },
            revert: 'invalid',
            revertDuration: 200,
            scroll: true,
            scrollSensitivity: 10,
            zIndex: 1500
        };

        return $.extend({}, defaultParams, params);
    };

    /**
     * Создает параметры дропа на основе базовых.
     * @param {Object} params объект с нужными параметрами
     * @return {Object} расширенные параметры
     */
    bAbook.makeDroppableParams = function(params) {
        var defaultParams = {
            tolerance: 'pointer',
            activeClass: 'g-drop-place',
            hoverClass: 'g-drop-place_hover'
        };

        return $.extend({}, defaultParams, params);
    };

    /**
     * Возвращает блок главного Абука.
     * @param {string} [type]
     * @returns {AbookBlock}
     */
    bAbook.getAbookBlock = function(type) {
        return Jane.watcher.get('abook-' + (type || 'normal') + '-instance');
    };

    /**
     * Возвращает активный блок "Контакты".
     * @return {AbookContactsBlock}
     */
    bAbook.getContactsBlock = function() {
        return bAbook.getAbookBlock().getContactsBlock();
    };

    /**
     * Возвращает cid'ы выделенных контактов.
     * @return {Array}
     */
    bAbook.getSelected = function() {
        return bAbook.getContactsBlock().getSelected();
    };

    /**
     * Инициализацию объекта метрики для адресной книги.
     */
    (function() {
        function wrap(obj, name) {
            var wrapper = {};
            wrapper[name] = obj;
            return wrapper;
        }

        var Metrika = {
            inited: false,
            instance: null,
            _bag: [],
            c: function() {
                var args = Array.prototype.slice.call(arguments);

                var obj = args.pop();
                while (args.length) {
                    obj = wrap(obj, args.pop());
                }

                if (this.inited) {
                    try {
                        this.instance.params(obj);
                    } catch(e) {}
                } else {
                    this._bag.push(obj);
                }
            }
        };

        Metrika.c = Metrika.c.bind(Metrika);

        Daria.Libs('Ya.Metrika', function() {
            /**
             * Отдельная метрика для адресной книги.
             * @see DARIA-28896
             */
            var settings = {
                ut: 'noindex',
                trackLinks: true,
                trackHash: true,
                id: 22327510
            };

            try {
                Metrika.instance = new Ya.Metrika(settings);
            } catch(e) {
                return;
            }

            Metrika.inited = true;
            Metrika._bag.forEach(function(args) {
                Metrika.instance.params(args);
            });
            Metrika._bag = [];
        });

        bAbook.Metrika = Metrika;
    })();

})(Jane, Daria);

/* ../../blocks/abook/abook.js end */

/* ../../blocks/abook-report/abook-report.js begin */
(function() {

    /**
     * Даные из хендлера Jane.$H("account-information").data
     * будет определен в кострукторе блока
     * @private
     * @type {}
     */
    var accountInfo;

    /**
     * Для показа отправки данных в ручку и отправки письма на рассылку
     * нам нужно это как-то показывать – будем это делать через спиннер марки
     * @private
     * @type {Jane.Loader}
     */
    var Loader = new Jane.Loader(false);

    /**
     * Для старых браузеров не хочется показывать анимацию
     * @private
     * @type {Boolean}
     */
    var isAnimatable = !Modernizr.ielt9;

    /**
     * Сообщения которые будут нужны для генерации письма в рассылку –
     * mail-organization-cards@yandex-team.ru, переводить их не нужно, так как отсылаются они нам
     * @private
     * @type {Object}
     */
    var messages = {
        errorType: "тип ошибки – ",
        comment: "комментарий – ",
        email: "эл. почта организации – ",
        login: "Логин – ",
        cardId: "номер карточки – ",

        subjects: {
            log: "Карточка организации – пользователь нажал на «Редактировать данные»",
            mail: "Ошибка в карточке организации, "
        },

        errors: {
            phone: "неправильный телефон",
            address: "неправильный адрес"
        }
    };

    /**
     * Общие свойства для отправки письма,
     * в последсвии расширяемой функцией отправителем
     * для передачи параметров Daria.SendMail.sendForm
     * @see Daria.SendMail.sendForm
     * @private
     * @type {Object}
     */
    var composeLetter = {
        params: {
            to: "mail-organization-cards@yandex-team.ru",
            nosave: "yes"
        }
    };

    /**
     * @constructor
     * @type {string} name - имя блока
     * @type {Object} params - объект формата - {
     *       $parent: родительский блок,
     *       $closer: инициализирующая псевдо-ссылка
     * }
     *
     */
    this.AbookReport = function(name, params) {
        Block.apply(this, arguments);

        // Определена выше
        accountInfo = Jane.$H("account-information").getData();

        var that = this;

        /**
         * Открыта ли форма?
         * @type {Boolean}
         */
        this.isOpen = false;

        /**
         * Элемент-родитель блока
         * @type {jQuery element}
         */
        this.$form = params.$parent.find(".block-report");

        /**
         * Инициализируем переданную псевдо-ссылку
         * @type {jQuery Object}
         */
        this.$closer = params.$closer;

        /**
         * Кнопка сабмит
         * @type {jQuery Object}
         */
        this.$button = this.$form.find(".b-mail-button");

        this.$form
        /**
         * Отправляем письмо на рассылку mail-organization-cards@yandex-team.ru,
         * при нажатии на ссылку «редактировать данные»,
         *
         * Не используем Action, нам нужно отсылать письмо и
         * при фокусировки на ссылку с последующим нажатием на ввот
         */
            .on("click keydown", ".b-report__link-edit", function() {
                that.log();
            })

            // Где-то выше чей-то код навешивается на событие отправки формы, выполняя свои темные действия
            // нам они не нужны, поэтому неиспользуем Action
            .on("submit", function() {
                if (that.$button.hasClass("b-mail-button_disabled")) {
                    return;
                }

                that.submit();

                return false;
            });
    };

    Daria.extend(this.AbookReport, this);

    this.add({
        name: "abook-report",
        info: {
            lazy: true,
            handlers: ["account-information", "company-info"]
        },
        constructor: this.AbookReport
    });

    /**
     * Показ формы
     */
    this.AbookReport.prototype.open = function() {
        if (this.isOpen) {
            return this;
        }

        this.isOpen = true;

        // Скрываем через транзитион
        this.$closer.addClass("b-report__hidden");

        // Скрываем через jQuery.fn.animate
        this.$form.slideDown(isAnimatable ? "slow" : 0);

        return this;
    };

    /**
     * Скрытие формы
     * @param  {Boolean} now Закрыть формы без анимации?
     */
    this.AbookReport.prototype.close = function(now) {
        if (!this.isOpen) {
            return this;
        }

        now = now || !isAnimatable ? 0 : "slow";
        var that = this;

        this.$closer.removeClass("b-report__hidden");
        this.$form.slideUp(now, function() {
            that.isOpen = false;

            // Выставляем поля формы в дефолтовое значение
            this.reset();
            Jane.enableButton(that.$button);
        });

        return this;
    };

    /**
     * Послание формы в рассылку mail-organization-cards@yandex-team.ru
     * @param  {Object} data  Сериализованные данные формы
     * @return {Deferred}
     */
    this.AbookReport.prototype.mail = function(data) {
        var type;
        var dfd = $.Deferred();
        var login = accountInfo.login;

        // Первым в теле собщения должен идти логин
        var body = messages.login + login + ",\n";

        // Экстендим дефалтовые настройки письма
        var letter = $.extend({
                $form: this.$form,

                // Решели что ошибки нам показывать не стоит,
                // этот интерфейс должен быть максимально простым.
                // Поэтому в любом случае показываем слова благодарности
                // и не слова о ошибке если таковая произошла
                success: function() {
                    dfd.resolve();
                },
                error: function() {
                    dfd.resolve();
                }
            }, composeLetter);

        // Заполняем тело письма
        body += type = messages.errorType + messages.errors[data.type];
        body += ",\n" + messages.cardId + data.id;
        body += data.email ? ",\n" + messages.email + data.email : "";

        if (data.comment) {
            body += ",\n\n" + messages.comment + data.comment;
        }

        letter.params.send = body;
        letter.params.subj = messages.subjects.mail +
            ( type + (data.email ? ", " + messages.email + data.email : "") ).replace(/\n/g, "");

        Daria.SendMail.sendForm(letter);

        return dfd;
    };

    /**
     * Пожаловаться в ручку об ошибке в карточке
     * @param  {Object} data сериализованные данные формы
     * @return {Deferred}
     */
    this.AbookReport.prototype.complain = function(data) {
        var dfd = $.Deferred();

        Jane.Handler.doAll([ "send-report" ], {
            company: data.id,
            type: data.type,
            uid: accountInfo.uid,
            comment: data.comment
        }, function() {
            dfd.resolve();
        });

        return dfd;
    };

    /**
     * Послание номера карточки и логина в рассылку mail-organization-cards@yandex-team.ru
     */
    this.AbookReport.prototype.log = function() {
        var id = this.$form[0]["card-id"].value;
        var letter = $.extend({
                $form: this.$form
            }, composeLetter);

        letter.params.subj = messages.subjects.log + ", " + messages.cardId.toLowerCase() + id;
        letter.params.send = messages.login + accountInfo.login + ",\n" + messages.cardId + id;

        this.close("now");
        Daria.SendMail.sendForm(letter);

        return this;
    };

    /**
     * Вызываем методы блока mail и complain
     * Показываем с крываем лоадер и выводим слова благодарности
     *
     * @see this.AbookReport.prototype.mail
     */
    this.AbookReport.prototype.send = function(data) {
        var that = this;

        Loader.start();

        $.when(this.mail(data), this.complain(data)).done(function() {
            Loader.stop();

            Daria.Statusline.showMsg({
                body: i18n("%Message_thank_you"),
                body3: i18n("%3pane_Message_thank_you")
            });

            that.close();
        });

        return this;
    };

    /**
     * Отправка формы
     */
    this.AbookReport.prototype.submit = function() {
        var form = this.$form[0];
        var nbComment = nb.block(form.comment);
        var data = {
                type: form.type.value,
                email: form.email.value,
                id: form["card-id"].value,
                comment: nbComment.getValue()
            };

        Jane.disableButton(this.$button);
        this.send(data);

        return this;
    };

}).call(Block);

/* ------------------------------------------------------------------------------------------------------------- */

/* ../../blocks/abook-report/abook-report.js end */

/* ../../blocks/abook-head/abook-head.js begin */
/* ######################################################################### */

(function(Daria, Jane) {
    var bAbookHead = Jane.Block.create('abook-head', {
        handlers: {
            'abook-letters': false,
            'abook-groups': true
        },
        params: {
            q: null
        },
        events: {
            'click .js-abook-head-toggler': 'toggleAll',
            'click .js-abook-head-lang-switch': 'changeLang',
            'click .abook-head-pager-symbol_link': 'symbolClickMetrika'
        },
        janeEvents: {
            'abook.entries:show-lazy': 'actualizeToggler',
            'abook.entries:show': 'uncheckToggler'
        }
    });

    var bAbookHeadProto = bAbookHead.prototype;

    bAbookHeadProto.onhtmlinit = function(node, params) {
        this.bAbook = Jane.Block.Abook.getAbookBlock(params.type);

        this.$node = $(node);
        this.$checkbox = this.$node.find('.js-abook-head-toggler');
    };

    bAbookHeadProto.onprepare = function(params) {
        // Для локалей ru, tt, uk, be дефолтом ставим русские буквы
        params.lang =
            Jane.watcher.get('abook.head:lang') ||
            Jane.$H('settings').getSetting('abook-switch-lang') ||
            (['ru', 'tt', 'uk', 'be'].indexOf(Daria.locale) >= 0 ? 'ru' : 'en');
        return true;
    };

    /**
     * Обработчик события обновления контактов
     * @private
     */
    bAbookHeadProto.actualizeToggler = function(_, abookType) {
        if (abookType !== this.params.type) {
            return;
        }
        var bAbookContacts = this.bAbook.getContactsBlock();

        var $contacts = bAbookContacts.getCurrentContactNodes();

        if ($contacts.length === 0) {
            this.$checkbox.prop('disabled', true);
            this.checkToggler(false);
        } else {
            this.$checkbox.prop('disabled', false);
            var $selectedContacts = bAbookContacts.getSelectedContactNodes();
            this.checkToggler($selectedContacts.length === $contacts.length);
        }
    };

    bAbookHeadProto.checkToggler = function(check) {
        this.$checkbox.prop('checked', check);
    };

    bAbookHeadProto.uncheckToggler = function(_, params) {
        if (params === this.params.type) {
            this.checkToggler(false);
        }
    };

    bAbookHeadProto.changeLang = function() {
        var lang = (this.getCurrentLang() === 'ru' ? 'en' : 'ru');

        Jane.Block.Abook.Metrika.c('Тулбар', 'Буковки', 'Переключение', (lang === 'en' ? 'На английский' : 'На русский'));

        Jane.$H('settings').setSettings({ 'abook-switch-lang': lang });
        Jane.watcher.set('abook.head:lang', lang);

        this.bAbook.getBlockByName('abook-head-box').invalidate();

        Jane.$B('app').run();
    };

    bAbookHeadProto.getCurrentLang = function() {
        return this.$node.find('.js-abook-pager-lang').data('lang');
    };

    /**
     * Инициирует ивент "Выделение всех контактов" для блока abook-contacts.
     */
    bAbookHeadProto.toggleAll = function() {
        var bContacts = this.bAbook.getContactsBlock();
        bContacts.toggleAll(this.$checkbox.prop('checked'));
    };

    bAbookHeadProto.symbolClickMetrika = function(e) {
        var locale = $(e.currentTarget).closest('.js-abook-pager-lang').data('lang');
        var lang = (locale === 'en' ? 'Клики по английским буквам' : 'Клики по русским буквам');
        Jane.Block.Abook.Metrika.c('Тулбар', 'Буковки', lang);
    };

})(Daria, Jane);

/* ../../blocks/abook-head/abook-head.js end */

/* ../../blocks/abook-contacts/abook-contacts.js begin */
/* ######################################################################### */

(function(Daria, Jane) {

    var CONTACTS_PAGE_SIZE = 30;

    var bAbookContacts = Jane.Block.create('abook-contacts', {
        blocks: ['abook-dropzone'],
        params: {
            q: null,
            tid: null
        },
        events: {
            'click .js-abook-load-more': 'loadMore',
            'click .js-abook-load-all': 'loadAll',
            'click .js-abook-popup-ok': 'onOk',
            'click .js-abook-popup-cancel': 'closePopup'
        }
    });

    var bAbookContactsProto = bAbookContacts.prototype;

    bAbookContactsProto.onhtmlinit = function(node, params) {
        this.$node = $(node);
        this.$container = this.$node.find('.js-entries-container');

        this.selectionChangedLazy = this.selectionChanged.lazy(0);

        this.isPopup =
            params.type === 'select' ||
            params.type === 'new-group' ||
            params.type === 'add-to-group';

        this.initParams = params;
        this.pageSize = CONTACTS_PAGE_SIZE;

        this.pager = null; // Объект pager приходящщий от хендлера abook-contacts
        this.pages = []; // Массив блоков abook-entries / abook-entries-select

        var shared;

        switch (params.type) {
            case 'normal':
                this.selected = [];
                break;
            case 'select':
                var fillingBlock = this.params.fillingBlock;

                shared = Jane.Block.Abook.getAbookBlock('select').getSharedInstance();
                shared.fields = shared.fields || {
                    to: Jane.FormValidation.splitContacts(fillingBlock.getTo()),
                    cc: Jane.FormValidation.splitContacts(fillingBlock.getCc()),
                    bcc: Jane.FormValidation.splitContacts(fillingBlock.getBcc())
                };

                this.selectedEmails = shared.fields;
                break;
            case 'new-group':
            case 'add-to-group':
                this.$node.find('.js-abook-popup-footer').removeClass('g-hidden');

                shared = Jane.Block.Abook.getAbookBlock(params.type).getSharedInstance();

                if (!shared.contacts) {
                    shared.contacts = { emails: [] };

                    var contactsData = Jane.$H('abook-contacts').getContactsData(this.params.selectedCids);
                    contactsData.forEach(function(contact) {
                        var id;
                        if (contact.email && contact.email.length) {
                            id = contact.cid + '.' + contact.email[0].id;
                        } else {
                            /**
                             * Для контактов без емейлов используется фейковый mcid: ContactId.0
                             * @see DARIA-33902
                             */
                            id = contact.cid + '.' + 0;
                        }
                        shared.contacts.emails.push(id);
                    });
                }

                this.selectedEmails = shared.contacts;
                break;
            default:
                throw new Error('abook-contacts onhtmlinit: unexpected block type.');
        }

        if (this.params.type === 'select' || this.params.type === 'add-to-group') {
            this.nbOkButton = nb.$block('.js-abook-popup-ok', this.$node);
        }

        Daria.setZeroTimeout(this.loadMore.bind(this));
    };

    bAbookContactsProto.onshow = function(params) {
        this.bindToolbarDrop(params.tid);

        this.selectionChangedLazy();

        this.pages.forEach(function(page) {
            if (!page.block.visible) {
                page.block.trigger('onshow');
                page.block.visible = true;
            }
        });
    };

    bAbookContactsProto.onrepaint = function() {
        if ($.isEmptyObject(Jane.$H('abook-contacts').cache)) {
            // TODO: Проверить правильность этого решения
            this.selected = [];
            this.selectionChanged();
        }

        // TODO: Подумать о оптимальности такого решения
        this.pages.forEach(function(page) {
            page.block.run(page.params, null, { parallel: true });
        });
    };

    bAbookContactsProto.onhide = function() {
        this.pages.forEach(function(page) {
            if (page.block.visible) {
                page.block.trigger('onhide');
                page.block.visible = false;
            }
        });

        if (this.params.type === 'normal') {
            this.deselectAll();
            this.unbindToolbarDrop();
        }

        this.selectionChangedLazy.reset(true);
    };

    bAbookContactsProto.onhtmldestroy = function() {
        this.pages.forEach(function(page) {
            page.block.destroy();
        });
    };

    /**
     * Чекает или анчекает все контакты.
     * @param {boolean} check
     */
    bAbookContactsProto.toggleAll = function(check) {
        if (check) {
            this.selectAll();
        } else {
            this.deselectAll();
        }
    };

    /**
     * @private
     */
    bAbookContactsProto.selectionChanged = function() {
        if (this.params.type === 'normal') {
            this.refreshToolbarButtons();
            this.checkMultiselect();
        }
        if (this.params.type === 'select' || this.params.type === 'add-to-group') {
            var allCount = 0;
            for (var key in this.selectedEmails) {
                allCount += this.selectedEmails[key].length;
            }
            if (allCount > 0) {
                this.nbOkButton.enable();
            } else {
                this.nbOkButton.disable();
            }
        }

        Jane.events.trigger('abook.contacts:selectionChange', this.params.type);
    };

    /**
     * Чекнуть все контакты.
     */
    bAbookContactsProto.selectAll = function() {
        this.pages.forEach(function(page) {
            if (page.block.isInited) {
                page.block.selectAll();
            }
        });
    };

    /**
     * Очищает массив сидов selected, снимает выделение с контактов.
     */
    bAbookContactsProto.deselectAll = function() {
        this.pages.forEach(function(page) {
            if (page.block.isInited) {
                page.block.deselectAll();
            }
        });
    };

    /**
     * Возвращает ноды контактов отображающихся сейчас на странице.
     */
    bAbookContactsProto.getCurrentContactNodes = function() {
        if (this.isPopup) {
            return this.$node.find('.abook-entries').children('.abook-entry:visible');
        } else {
            return this.$node.find('.abook-entry:visible');
        }
    };

    /**
     * Возвращает ноды выделенных контактов отображающихся сейчас на странице.
     */
    bAbookContactsProto.getSelectedContactNodes = function() {
        if (this.isPopup) {
            return this.$node.find('.abook-entries').children('.abook-entry:visible').has(':checked');
        } else {
            return this.$node.find('.abook-entry.abook-entry_selected:visible');
        }
    };

    /**
     * Написать письмо выделенным контактам.
     */
    bAbookContactsProto.writeToSelection = function() {
        // Если есть выделение, то пишем выделенным контактам
        if (this.selected.length) {
            Daria.composeParams = this.selectedToString();
            Daria.Page.go('#compose');
        }
    };

    /**
     * Тоглит кнопки в тулбаре в зависимости от того, чекнуты контакты или нет.
     */
    bAbookContactsProto.refreshToolbarButtons = function() {
        var somethingSelected = !!this.selected.length;
        var selectedInGroup = !!(somethingSelected && Daria.Page.params.tid);

        Daria.Toolbar.setButtonStatus('abook-remove', somethingSelected);
        Daria.Toolbar.setButtonStatus('abook-togroup', somethingSelected);
        Daria.Toolbar.setButtonStatus('abook-outofgroup', selectedInGroup);

        // делаем кнопку "написать" не активной, когда выделено больше 50 контактов
        if (this.selected.length > 50) {
            Daria.Toolbar.setButtonStatus('compose', false);
            // вешаем другой экшен, в котором выводится сообщение о том,
            // что нельзя написать более 50 контактам.
            $('.js-toolbar-item-compose').attr('data-action', 'abook.noactive-add-compose');
        } else {
            Daria.Toolbar.setButtonStatus('compose', true);
        }

        var selectedContacts = Jane.$H('abook-contacts').getContactsData(this.selected);
        if (selectedContacts.length === 1 && !selectedContacts[0].email.length) {
            Daria.Toolbar.setButtonStatus('compose', false);
        }
    };

    /**
     * Добавляет cid в selected.
     * @param {string} cid айди контакта
     */
    bAbookContactsProto.addCidToSelected = function(cid) {
        if (this.selected.indexOf(cid) === -1) {
            this.selected.push(cid);
        }
        this.selectionChangedLazy();
    };

    /**
     * Удаляет cid из selected.
     * @param {string} cid айди контакта
     */
    bAbookContactsProto.removeCidFromSelected = function(cid) {
        var index = this.selected.indexOf(cid);
        if (index !== -1) {
            this.selected.splice(index, 1);
        }
        this.selectionChangedLazy();
    };

    /**
     * Инициализирует дроп на кнопки тулбара "удалить", "добавить в группу" и т.д.
     * @param {string} tid текущий tid
     */
    bAbookContactsProto.bindToolbarDrop = function(tid) {
        var $toolbar = $(Jane.$B('toolbar-box').getActiveCacheNode());

        var toolbarButtonsClasses = '.js-toolbar-item-abook-remove, .js-toolbar-item-abook-togroup';

        if (tid) {
            toolbarButtonsClasses += ', .js-toolbar-item-abook-outofgroup';
        }

        var dropParams = Block.Abook.makeDroppableParams({
            accept: '.abook-entry',
            drop: this.dropContactOnToolbar.bind(this)
        });

        this.$droppableButtons = $toolbar.find(toolbarButtonsClasses).droppable(dropParams);
    };

    bAbookContactsProto.unbindToolbarDrop = function() {
        if (this.$droppableButtons) {
            try {
                this.$droppableButtons.droppable('destroy');
            } catch(e) {}
        }
    };

    /**
     * Обработчик дропа контакта на кноки тулбара.
     * @param {Event} e
     * @param {Object} dropParams Объект параметров, прокидывается jQuery
     */
    bAbookContactsProto.dropContactOnToolbar = function(e, dropParams) {
        // При дропе currentTarget это документ, из-за этого все фейлится.
        e.currentTarget = e.target;

        var $node = $(e.target);

        /**
         * Если мы перетаскиваем контакт на кнопку "Добавить в группу", то покажется менюшка
         * выбора группы и чтобы действие из меню сработало, нужно оставить контакт выбранным.
         */
        if ($node.is('.js-toolbar-item-abook-togroup')) {
            dropParams.helper.data('deselect', false);
        }
        Jane.Actions.run($node.data('action'), e);
    };

    /**
     * Загружает следующую порцию контактов.
     * @param {Event} [e]
     * @param {boolean} [loadAll] загружать все контакты
     */
    bAbookContactsProto.loadMore = function(e, loadAll) {
        var that = this;

        if (e) {
            Jane.Block.Abook.Metrika.c('Список контактов', (loadAll ? 'Клик по Показать все контакты' : 'Клик по Ещё контакты'));
        }

        if (this.isLoading) {
            return;
        }
        this.isLoading = true;
        that.toggleMore(false);

        var blockName = (this.isPopup ? 'abook-entries-select' : 'abook-entries');

        var params = null;

        if (this.params.type === 'add-to-group') {
            params = $.extend({ mode: 'selected' }, this.initParams);
        } else {
            params = $.extend({ pagesize: this.pageSize }, this.initParams);

            if (this.pager) {
                if (!this.checkMoreItems()) {
                    return;
                }

                if (loadAll) {
                    params.skip = (this.pager.current + 1) * this.pager['items-per-page'];
                } else {
                    params.page = this.pager.current + 1;
                }
            } else {
                params.page = 0;
            }
        }

        if (this.isPopup) {
            // TODO: Упростить передачу выделенных объектов
            params.selectedEmails = this.selectedEmails;
        }

        var newBlock = Jane.Block.make(blockName, params);

        // Сохраняем в локальном хеше все блоки entries
        this.pages.push({ block: newBlock, params: params });

        newBlock.run(params, function() {
            var entriesNode = newBlock.getCacheNode();
            that.$container.append(entriesNode);

            that.isLoading = false;
        }, {
            onerror: function() {
                that.toggleMore(true);

                that.isLoading = false;
            },
            parallel: true
        });
    };

    /**
     * Показать все контакты.
     * @param {Object} e объект-ивент клика на кнопу «показать все контакты»
     */
    bAbookContactsProto.loadAll = function(e) {
        this.loadMore(e, true);
    };

    /**
     * Обновляет блок подгрузки страниц в футере.
     * @param {Object} pager
     */
    bAbookContactsProto.updatePager = function(pager) {
        this.pager = pager;
        this.$node.find('.js-abook-more-count').text(this.pager['items-count'] || '');

        this.toggleMore(this.checkMoreItems());
    };

    /**
     * Валидирует наличие незагруженых контактов.
     * @return {boolean}
     */
    bAbookContactsProto.checkMoreItems = function() {
        return this.pager.current + 1 < this.pager['pages-count'];
    };

    /**
     * Переключает видимость кнопок "еще".
     * @param {boolean} visible
     */
    bAbookContactsProto.toggleMore = function(visible) {
        this.$node.find('.js-abook-more').toggleClass('g-hidden', !visible);
    };

    /**
     * Возвращает массив выделенных контактов.
     * @return {Array}
     */
    bAbookContactsProto.getSelected = function() {
        return [].concat(this.selected);
    };

    bAbookContactsProto.getSelectedWithMcids = function() {
        var result = {};
        this.selected.forEach(function(cid) {
            result[cid] = [];
        });

        var mcids = Jane.$H('abook-contacts').getMcids(this.selected, this.params.tid);

        mcids.forEach(function(mcid) {
            var cid = mcid.split('.')[0];
            result[cid].push(mcid);
        });
        return result;
    };

    /**
     * @private
     */
    bAbookContactsProto.checkMultiselect = function() {
        this.$node.toggleClass('abook-contacts__multiselect', this.selected.length > 1);
    };

    bAbookContactsProto.onOk = function() {
        if (this.params.type === 'select') {
            this.fillComposeFields();
        } else if (this.params.type === 'add-to-group'){
            this.addSelectedToGroup();
        }
    };

    /*************************************************************************
     * Часть относящаяся к режиму работы в попапе выбора емейлов.
     *
     *************************************************************************/

    /**
     * Добавляет контакт (емейл) в список выделенных.
     * @param {Object} contact
     * @param {string} field
     */
    bAbookContactsProto.addMailToSelected = function(contact, field) {
        var alreadyInTargetList = false;

        this.selectedEmails[field].forEach(function(email) {
            if (email.email === contact.email && (email.name === contact.name || !email.name)) {
                alreadyInTargetList = true;
                return false;
            }
        });

        if (!alreadyInTargetList) {
            this.removeMailFromSelected(contact);

            this.selectedEmails[field].push(contact);
            this.selectionChangedLazy();
        }
    };

    /**
     * Удаляет контакт (емейл) из списка выделенных.
     * @param {Object} contact
     */
    bAbookContactsProto.removeMailFromSelected = function(contact) {

        var selectedEmails = this.selectedEmails;
        /** selectedEmails имеет вид
         * { to: [...], cc: [...], bcc: [...] }
         */
        var somethingChanged = false;

        $.each(selectedEmails, function(field) {
            selectedEmails[field] = selectedEmails[field].filter(function(email) {
                if (email.email === contact.email && (email.name === contact.name || !email.name)) {
                    somethingChanged = true;
                    return false;
                } else {
                    return true;
                }
            });
        });

        if (somethingChanged) {
            this.selectionChangedLazy();
        }
    };

    /**
     * Превращает контакты, которые находит в selected, в строку.
     * @return {string} строка из имейлов и имен
     */
    bAbookContactsProto.selectedToString = function() {
        var data = Jane.$H('abook-contacts').getContactsData(this.selected);
        var tid = Number(this.params.tid);

        var mails = $.map(data, function(contact) {
            if (!contact.email.length) {
                return null;
            }

            var writeEmail;
            if (tid) {
                contact.email.forEach(function(email) {
                    if (email.tags.indexOf(tid) !== -1) {
                        writeEmail = email.value;
                        return false;
                    }
                });
            } else {
                writeEmail = contact.email[0].value;
            }

            return Jane.FormValidation.obj2contact({
                email: writeEmail,
                name: contact.name.full
            });
        });

        return { to: mails.join(', ') };
    };

    /**
     * @private
     * @param {Array} contacts
     * @return {string}
     */
    bAbookContactsProto.emailsToSting = function(contacts) {
        return contacts.map(function(contactEmail) {
            return Jane.FormValidation.obj2contact(contactEmail);
        }).join(', ');
    };

    /**
     * Вставляет выделенные емейлы в поля формы отправки письма.
     */
    bAbookContactsProto.fillComposeFields = function() {
        var block = this.params.fillingBlock;
        block.setTo(this.emailsToSting(this.selectedEmails.to));
        block.setCc(this.emailsToSting(this.selectedEmails.cc));
        block.setBcc(this.emailsToSting(this.selectedEmails.bcc));

        if (block.samplesRemoveRepeats) {
            block.samplesRemoveRepeats();
        }

        this.closePopup();

        block.focus();
    };

    bAbookContactsProto.closePopup = function() {
        Daria.Dialog.close();
    };


    /**
     * Расширение прототипа функциями для диалога создания группы.
     * (new-group)
     */

    /**
     * Добавляет mcid в список выделенных.
     * @param {number|string} mcid
     */
    bAbookContactsProto.addMcidToSelected = function(mcid) {
        var mcidStr = String(mcid);

        if (this.selectedEmails.emails.indexOf(mcidStr) === -1) {
            this.selectedEmails.emails.push(mcidStr);
            this.selectionChangedLazy();
        }
    };

    /**
     * Удаляет mcid из списка выделенных.
     * @param {number|string} mcid
     */
    bAbookContactsProto.removeMcidFromSelected = function(mcid) {
        var mcidStr = String(mcid);

        var idx = this.selectedEmails.emails.indexOf(mcidStr);
        if (idx !== -1) {
            this.selectedEmails.emails.splice(idx, 1);
            this.selectionChangedLazy();
        }
    };

    /**
     * Возвращает список выделенных mcid'ов.
     * @return {Array}
     */
    bAbookContactsProto.getSelectedMcids = function() {
        return [].concat(this.selectedEmails.emails);
    };


    /**
     * Расширение прототипа функциями для диалога добавления контактов в группу.
     * (add-to-group)
     */

    /**
     * Добавление контактов и закрытие диалога.
     */
    bAbookContactsProto.addSelectedToGroup = function() {
        var tid = this.params.targetTid;
        Jane.$H('abook-groups').addToGroup({ tid: tid, mcids: this.selectedEmails.emails }).then(function() {
            Daria.Dialog.close();
            Jane.$B('app').run();
        });
    };

})(Daria, Jane);

/* ../../blocks/abook-contacts/abook-contacts.js end */

/* ../../blocks/abook-head-box/abook-head-box.js begin */
(function() {
    var bAbookHeadBox = Jane.Block.create('abook-head-box', {
        box: true,
        handlers: {
            'abook-groups': false
        }
    });

    bAbookHeadBox.prototype.onhtmlinit = function(node, params) {
        this.bAbook = Jane.Block.Abook.getAbookBlock(params.type);

        if (params.type === 'select' || params.type === 'new-group') {
            this.nbGroupSelect = nb.$block('.js-abook-head-box-group-select', $(node));
            if (this.nbGroupSelect) {
                this.nbGroupSelect.on('nb-changed', this.changeGroup.bind(this));
            }
        }
    };

    bAbookHeadBox.prototype.selectName = function(params) {
        /**
         * Этот код должен быть в событии onrepaint, но оно не вызывается у box'ов.
         */
        this.params = params;
        if (this.nbGroupSelect) {
            this.nbGroupSelect.setState({ value: (params.tid === '' ? 'all' : params.tid) });
        }

        return 'abook-head';
    };

    /**
     * Используется в попапе выбора емейлов для композа.
     */
    bAbookHeadBox.prototype.changeGroup = function() {
        var tid = String(this.nbGroupSelect.getState().value);
        if (tid === 'all') {
            tid = '';
        }
        if (this.params.tid !== tid) {
            this.bAbook.changeGroup(tid);
        }
    };
})();

/* ../../blocks/abook-head-box/abook-head-box.js end */

/* ../../blocks/abook-box/abook-contacts-box.js begin */
(function(Jane) {
    var bAbookContactsBox = Jane.Block.create('abook-contacts-box', {
        box: true
    });

    bAbookContactsBox.prototype.selectName = function() {
        return 'abook-contacts';
    };
})(Jane);

/* ../../blocks/abook-box/abook-contacts-box.js end */

/* ../../blocks/abook-box/abook-new-group-panel-box.js begin */
(function() {
    var bAbookNewGroupPanelBox = Jane.Block.create('abook-new-group-panel-box', {
        box: true
    });

    bAbookNewGroupPanelBox.prototype.selectName = function(params) {
        if (params.type === 'new-group') {
            return 'abook-new-group-panel';
        } else {
            return '';
        }
    };
})(Jane);

/* ../../blocks/abook-box/abook-new-group-panel-box.js end */

/* ../../blocks/abook-new-group-panel/abook-new-group-panel.js begin */
(function(Jane) {

    var GROUP_NAME_MAX_LENGTH = 40;
    var ENTER_KEYCODE = 13;

    var bAbookNewGroupPanel = Jane.Block.create('abook-new-group-panel', {
        events: {
            'click .js-group-create': 'createGroup',
            'click .js-group-cancel': 'closeDialog',
            'click .js-remove-contact': 'removeContact',
            'keydown .js-group-name': 'onGroupNameKeyDown'
        },
        janeEvents: {
            'abook.contacts:selectionChange': 'refreshList'
        }
    });

    var bAbookNewGroupPanelProto = bAbookNewGroupPanel.prototype;

    bAbookNewGroupPanelProto.onhtmlinit = function(node) {
        var that = this;
        this.$node = $(node);

        this.nbGroupName = nb.block(this.$node.find('.js-group-name').get(0));
        this.nbGroupName.$node.on('keyup', function() {
            /**
             * Для старых браузеров не показываем интерактивную ошибку.
             */
            if (Modernizr.ielt10) {
                that.nbGroupName.hideError();
            } else {
                var groupName = that.nbGroupName.getValue().trim();
                if (groupName.length <= GROUP_NAME_MAX_LENGTH) {
                    that.nbGroupName.hideError();
                } else {
                    that.nbGroupName.showError({
                        // FIXME: Почему необходимо подниматься до блока?
                        appendTo: that.$node.closest('.block-abook')
                    });
                    /**
                     * Почему-то, теряется фокус через мгновение.
                     * 200ms - эксперементально-магическое число.
                     */
                    setTimeout(function() {
                        that.nbGroupName.focus();
                    }, 200);
                }
                /* showError - снимает фокус с элемента =(
                 * @see https://github.com/yandex-ui/nanoislands/issues/274
                 */
                that.nbGroupName.focus();
            }
        });

        var bAbook = Jane.Block.Abook.getAbookBlock('new-group');
        this.bAbookContacts = bAbook.getContactsBlock();
    };

    bAbookNewGroupPanelProto.refreshList = function(_, abookType) {
        if (abookType !== this.params.type) {
            return;
        }
        var hAbookContacts = Jane.$H('abook-contacts');
        var cidsData = {};
        var mcids = this.bAbookContacts.getSelectedMcids();

        mcids.forEach(function(mcid) {
            var cid = mcid.split('.')[0];
            cidsData[cid] = true;
        });

        $.each(cidsData, function(cid) {
            cidsData[cid] = hAbookContacts.getContactData(cid);
        });

        var contacts = mcids.map(function(mcid) {
            var mcidParts = mcid.split('.');
            var cid = mcidParts[0];
            var mid = mcidParts[1];

            var email = '';
            if (cidsData[cid].email) {
                cidsData[cid].email.forEach(function(emailData) {
                    if (emailData.id == mid) {
                        email = emailData.value;
                        return false;
                    }
                });
            }

            return {
                mcid: mcid,
                name: cidsData[cid].name.full,
                email: email
            };
        });

        this.invalidate();
        this.run($.extend({}, this.params, { contact: contacts, groupName: this.nbGroupName.getValue() }));

        this.$node.find('.abook-new-group-panel')
            .toggleClass('abook-new-group-panel_limit', contacts.length > 50);
    };

    bAbookNewGroupPanelProto.removeContact = function(e) {
        var mcid = $(e.target).parent().data('mcid');

        this.bAbookContacts.removeMcidFromSelected(mcid);
    };

    bAbookNewGroupPanelProto.onGroupNameKeyDown = function(e) {
        if (e.which === ENTER_KEYCODE) {
            this.createGroup();
        }
    };

    bAbookNewGroupPanelProto.createGroup = function() {
        var groupName = this.nbGroupName.getValue().trim();
        if (!groupName || groupName.length > GROUP_NAME_MAX_LENGTH) {
            if (Modernizr.ielt10) {
                /**
                 * Дублирование кода с обработкой события выше. Стереть после резолва бага:
                 * @see https://github.com/yandex-ui/nanoislands/issues/274
                 */
                if (groupName.length > GROUP_NAME_MAX_LENGTH) {
                    this.nbGroupName.showError({
                        appendTo: this.$node.closest('.block-abook')
                    });
                }
            }
            this.nbGroupName.focus();
            return;
        }

        var selectedContacts = this.bAbookContacts.getSelectedMcids().map(function(mcid) {
            // Приводим mcid 123.0 к виду 123
            var mcidPair = mcid.split('.');
            return (mcidPair[1] === '0' ? mcidPair[0] : mcid);
        });

        var params = {
            title: groupName,
            mcid: selectedContacts
        };

        // TODO: Добавить проверку на ошибку
        Jane.Handler.doAll(['do-abook-group-add'], params, function(data) {
            var tid = jpath(data, '.handlers[0].data.tid')[0];

            if (!tid) {
                Daria.Statusline.showMsg({
                    body: i18n('%АК_фэйл'),
                    body3: i18n('%3pane_АК_фэйл')
                });
                return;
            }

            Jane.$H('abook-contacts').clearCache();
            Jane.$H('abook-contact').clearCache();
            Jane.$H('abook-groups').clearCache();
            Jane.$H('abook-letters').clearCache();

            Daria.Dialog.close();
            Daria.Autocompleter.getContact().flushCache();

            Daria.Page.go('#contacts/group' + tid);
        });
    };

    bAbookNewGroupPanelProto.closeDialog = function() {
        Daria.Dialog.cancel();
    };

})(Jane);

/* ../../blocks/abook-new-group-panel/abook-new-group-panel.js end */

/* ../../blocks/abook-dropzone/abook-dropzone.js begin */
(function(Daria, Jane) {
    var bAbookDropzone = Jane.Block.create('abook-dropzone', {
        handlers: ['abook-groups'],
        events: {
            'change .abook-file-adder-button': 'fileUpload',
            'change .abook-file-drop-mode': 'fileUpload'
        }
    });

    var bAbookDropzoneProto = bAbookDropzone.prototype;

    bAbookDropzoneProto.onhtmlinit = function(node) {
        this.$node = $(node);

        if (this.$node.find('.js-abook-dropzone').length) {
            // Modernizr['draganddrop-files']
            this.$node.find('.abook-file-adder-ckey').val(Daria.Page.ckey);
            this.bindFileDrop();

            metrika('Показ');
        }
    };

    bAbookDropzoneProto.onhtmldestroy = function() {
        clearTimeout(this._uploadErrorTimeout);
        clearTimeout(this._uploadSuccessTimeout);

        this.unbindFileDrop();
    };

    /**
     * Обработка загрузки файлов с контактами
     */
    bAbookDropzoneProto.fileUpload = function(e) {
        if ($(e.currentTarget).is('.abook-file-adder-button')) {
            metrika('Клик по кнопке Перенести');
        } else {
            metrika('Драг-н-дроп файла на страницу');
        }

        this.$form = this.$node.find('.abook-file-adder');

        // Оставляем влюченым нужный инпут.
        this.$form.find('input[type="file"]').not(e.target).prop('disabled', true);

        this.$form.ajaxSubmit({
            iframe: true,
            dataType: 'json',
            success: this._submitSuccess.bind(this),
            error: this._submitError.bind(this)
        });
    };

    bAbookDropzoneProto._submitError = function() {
        var that = this;
        var $misc = this.$form.find('.abook-file-adder-misc');
        var $error = this.$form.find('.abook-file-adder-error');

        metrika('Показ ошибки');

        this.$form.find('input[type="file"]').prop('disabled', false);

        $misc.addClass('g-hidden');
        $error.removeClass('g-hidden');

        this._uploadErrorTimeout = setTimeout(function() {
            $misc.removeClass('g-hidden');
            $error.addClass('g-hidden');
            that.$form.resetForm();
        }, 2000);
    };

    bAbookDropzoneProto._submitSuccess = function(data) {
        this.$form.find('input[type="file"]').prop('disabled', false);

        if (!data || data.error) {
            this._submitError();
            return;
        }
        metrika('Контакты успешно перенесены');

        this.$form.addClass('g-hidden');
        this.$node.find('.abook-file-success').removeClass('g-hidden');

        Jane.$H('abook-contacts').clearCache();
        Jane.$H('abook-letters').clearCache();
        Jane.$H('abook-groups').clearCache();
        Daria.Autocompleter.getContact().flushCache();

        this._uploadSuccessTimeout = setTimeout(function() {
            Daria.Page.go('#contacts/all');
        }, 3000);
    };

    /**
     * Инициализирует дроп файлов с контактными книгами на область.
     */
    bAbookDropzoneProto.bindFileDrop = function() {
        var $node = this.$node.find('.abook-file-adder');
        var $veil = $node.find('.abook-file-adder-veil');
        this.$input = $veil.find('.abook-file-drop-mode');

        $(document).on('dragover.abook', function(e) {
            e.preventDefault();
        });

        $node.on('dragenter', function() {
            $veil.removeClass('g-hidden');
            $node.addClass('abook-file-adder_hover');
        });

        this.$input
            .on('dragenter', function(e) {
                e.stopPropagation();
            })
            .on('dragleave drop', function() {
                $veil.addClass('g-hidden');
                $node.removeClass('abook-file-adder_hover');
            });
    };

    bAbookDropzoneProto.unbindFileDrop = function() {
        this.$node.find('.abook-file-adder, .abook-file-adder-veil').off();
        $(document).off('dragover.abook');

        if (this.$input) {
            this.$input.off();
        }
    };


    /**
     * Хелперы для метрики.
     */

    function metrika(part) {
        Jane.Block.Abook.Metrika.c('Перенос контактов', 'В пустой АК', part);
    }

})(Daria, Jane);

/* ../../blocks/abook-dropzone/abook-dropzone.js end */

/* ../../blocks/abook-entries/abook-entries.js begin */
(function(Jane) {
    var bAbookEntries = Jane.Block.create('abook-entries', {
        handlers: ['abook-contacts', 'abook-groups'],
        events: {
            'click .abook-entry-checkbox': '_stopPropagation',
            'click .abook-entry-checkbox-controller': 'toggleContact',
            'click .abook-entry-compose-link': 'write',
            'click .js-abook-entry': 'showPersonPopup',
            'click .js-abook-entry-remaining': 'showEmailsDropdown',
            'click A': '_stopPropagation',

            'click .js-abook-entry-write': 'writeClickMetrika',
            'click .abook-entry-userpic': 'avaClickMetrika',
            'click .abook-entry-name-content': 'nameClickMetrika',
            'click .abook-entry-email-content': 'emailClickMetrika',
            'click .abook-entry-phone-content': 'phoneClickMetrika',
            'click .js-abook-label': 'groupClickMetrika'
        }
    });

    var bAbookEntriesProto = bAbookEntries.prototype;

    bAbookEntriesProto.onhtmlinit = function(node, params) {
        this.$node = $(node);
        this.isInited = true;

        this.bAbookContacts = Jane.Block.Abook.getContactsBlock();

        var cacheNode = Jane.$H('abook-contacts').getCacheByParams(params);
        this.bAbookContacts.updatePager(cacheNode.pager);

        this.triggerMarkupChangeLazy = this.triggerMarkupChange.lazy(0);

        Daria.SocialAvatarsAbook(this.$node.find('.abook-entries'), params);

        this.bindContactsDragAndDrop();
    };

    bAbookEntriesProto.onshow = function() {
        Jane.events.trigger('abook.entries:show', 'normal');
        this.checkSelected();
    };

    bAbookEntriesProto.onhide = function() {
        this.triggerMarkupChangeLazy.reset();
    };

    bAbookEntriesProto.onhtmldestroy = function() {
        this.unbindContactsDragAndDrop();
    };

    /**
     * Инициализирует драг контактов и дроп на группы.
     * @private
     */
    bAbookEntriesProto.bindContactsDragAndDrop = function() {
        if (Modernizr.ielt9) {
            return;
        }

        var $entries = this.$node.find('.abook-entry');
        if ($entries.length) {
            var dragParams = Block.Abook.makeDraggableParams({
                helper: this.initDragHelper.bind(this),
                stop: this.dragStop.bind(this)
            });

            var dropParams = Block.Abook.makeDroppableParams({
                drop: this.initDrop.bind(this),
                accept: '.abook-group'
            });

            $entries.draggable(dragParams);
            $entries.droppable(dropParams);

            this.$dragDropEntries = $entries;
        }
    };

    /**
     * Откывает диалог просмотра/редактирования контакта.
     * @param {Object} e
     */
    bAbookEntriesProto.showPersonPopup = function(e) {
        var cid = $(e.currentTarget).closest('.js-abook-entry').data('cid');

        Daria.Abook.PersonPopup.open({ cid: cid }, e);
        e.stopPropagation();
    };

    /**
     * Снимает Draggable и Droppable плагины
     * @private
     */
    bAbookEntriesProto.unbindContactsDragAndDrop = function() {
        if (this.$dragDropEntries) {
            /**
             * В каких-то странных кейсах, jQuery падает при destroy.
             */
            try {
                this.$dragDropEntries.droppable('destroy');
            } catch(e) { }
            try {
                this.$dragDropEntries.not(this.$currentDragContact).draggable('destroy');
            } catch(e) { }

            /**
             * Если в момент дестроя блока человек уже тащит другой контакт,
             * то уничтожение draggable приводит к повисшему хендлеру контакта.
             * Поэтому мы удаляем его после завершения cancel().
             */
            if (this.$currentDragContact) {
                this.$currentDragContact.data('self-destroy', true);
                this.$currentDragContact.data('ui-draggable').cancel();
                this.$currentDragContact = null;
            }
        }
    };

    /**
     * Вызывает чек или анчек контакта.
     * @param {Object} e объект-ивент клика на чекбокс контакта
     */
    bAbookEntriesProto.toggleContact = function(e) {
        var $checkbox = $(e.target);

        if ($checkbox.is(':checked')) {
            this.selectContact($checkbox);
        } else {
            this.deselectContact($checkbox);
        }
        e.stopPropagation();
    };

    /**
     * @private
     */
    bAbookEntriesProto._stopPropagation = function(e) {
        e.stopPropagation();
    };

    /**
     * Чекает чекбокс контакта, ставит класс,
     * вытаскивает в selected сид, тоглит кнопки в тулбаре.
     * @param {Object} $node нода контакта или внутри
     * а из ивента, поэтому нужно чекбоксу поставить галочку через js
     */
    bAbookEntriesProto.selectContact = function($node) {
        var $entry = $node.closest('.abook-entry');

        $entry.find('.abook-entry-checkbox-controller').not(':checked').prop('checked', true);
        $entry.addClass('abook-entry_selected');

        this.bAbookContacts.addCidToSelected($entry.data('cid'));

        this.triggerMarkupChangeLazy();
    };

    /**
     * Анчекает контакт, удаляет класс, удаляет сид из selected, тоглит кнопки.
     * @param {Object} $node нода контакта
     */
    bAbookEntriesProto.deselectContact = function($node) {
        var $entry = $node.closest('.abook-entry');

        $entry.removeClass('abook-entry_selected');
        $entry.find('.abook-entry-checkbox-controller:checked').prop('checked', false);

        this.bAbookContacts.removeCidFromSelected($entry.data('cid'));

        this.triggerMarkupChangeLazy();
    };

    /**
     * Чекнуть все контакты.
     */
    bAbookEntriesProto.selectAll = function() {
        var that = this;
        var $entries = this.$node.find('.abook-entry').not('.abook-entry_selected');
        $entries.each(function() {
            that.selectContact($(this));
        });
    };

    /**
     * Снимает выделение с контактов.
     */
    bAbookEntriesProto.deselectAll = function() {
        var that = this;
        var $entries = this.$node.find('.abook-entry_selected');
        $entries.each(function() {
            that.deselectContact($(this));
        });
    };

    bAbookEntriesProto.triggerMarkupChange = function() {
        Jane.events.trigger('abook.entries:show-lazy', 'normal');
    };

    /**
     * Клик по кнопке "написать"
     * @param {Event} e
     */
    bAbookEntriesProto.write = function(e) {
        var $contact = $(e.target).closest('.abook-entry');
        this.selectContact($contact);

        this.bAbookContacts.writeToSelection();
        e.preventDefault();
    };

    /**
     * Создает ноду-хелпера, который отображается при драге контакта.
     * @param {Object} e объект-ивент начала драга
     * @return {Node} нода хелпера
     */
    bAbookEntriesProto.initDragHelper = function(e) {
        var $contact = $(e.currentTarget);
        this.$currentDragContact = $contact;

        Daria.Dialog.close();

        var deselect = false;
        var selectedCount = this.bAbookContacts.getSelected().length;
        if (selectedCount === 0) {
            deselect = true;
            selectedCount = 1;
        }

        this.selectContact($contact, true);

        var $node = $(Jane.tt('mail-abook:drag-helper', { contacts: selectedCount }));
        $node.data('deselect', deselect);

        return $node;
    };

    /**
     * Инициализирует действия на конец драга контакта.
     */
    bAbookEntriesProto.dragStop = function(e, dropParams) {
        this.$currentDragContact = null;

        var $contact = $(e.target);
        if ($contact.data('self-destroy')) {
            $contact.draggable('destroy');
        }

        if (dropParams.helper.data('deselect')) {
            this.bAbookContacts.deselectAll();
        }
    };

    /**
     * Инициализирует действия на дроп ноды контакта.
     * @param {Object} e
     * @param {Object} helper
     */
    bAbookEntriesProto.initDrop = function(e, helper) {
        var $contact = $(e.target);
        var $group = helper.draggable;

        var cid = $contact.data('cid');
        var tid = $group.data('tid');

        var contact = Jane.$H('abook-contacts').getContactData(cid);

        this.$currentDragContact = null;

        if (!contact.email || contact.email.length === 0) {
            Jane.$H('abook-groups').addToGroup({ tid: tid, mcids: [cid] }).then(function() {
                Jane.$B('app').run();
            });
        } else if (contact.email.length === 1) {
            Jane.$H('abook-groups').addToGroup({ tid: tid, mcids: [cid + '.' + contact.email[0].id] })
                .then(function() {
                    Jane.$B('app').run();
                });
        } else {
            // Если у контакта один емейл, то добавляем в группу, если несколько, то показываем попап выбора
            Block.Abook.showDropPopup($contact, {
                tid: this.params.tid,
                targetTid: tid,
                cid: cid,
                emails: contact.email
            });
        }
    };

    /**
     * Приводит состояние верстки к реальному выделению.
     * @private
     */
    bAbookEntriesProto.checkSelected = function() {
        var $node = this.$node;
        this.bAbookContacts.getSelected().forEach(function(cid) {
            var $contact = $node.find('.abook-entry[data-cid="' + cid + '"]');
            $contact.addClass('abook-entry_selected');
            $contact.find('.abook-entry-checkbox-controller').prop('checked', true);
        });

        this.triggerMarkupChangeLazy();
    };

    /**
     * Показывает выпадушку со списком всех емейлов.
     * @param {Event} e
     */
    bAbookEntriesProto.showEmailsDropdown = function(e) {
        metrika('Клик по ещё N');

        var $target = $(e.currentTarget);
        var $entry = $target.closest('.js-abook-entry');
        var cid = $entry.data('cid');

        Block.Abook.showDropPopup($target, {
            type: 'list',
            tid: this.params.tid,
            cid: cid
        });
        e.stopPropagation();
    };


    /**
     * Хелперы для метрики.
     */

    function metrika(elementName) {
        Jane.Block.Abook.Metrika.c('Список контактов', elementName);
    }

    bAbookEntriesProto.writeClickMetrika = metrika.bind(null, 'Клик по Написать');
    bAbookEntriesProto.avaClickMetrika   = metrika.bind(null, 'Клик по аватарке');
    bAbookEntriesProto.nameClickMetrika  = metrika.bind(null, 'Клик по имени');
    bAbookEntriesProto.emailClickMetrika = metrika.bind(null, 'Клик по адресу');
    bAbookEntriesProto.phoneClickMetrika = metrika.bind(null, 'Клик по телефону');
    bAbookEntriesProto.groupClickMetrika = metrika.bind(null, 'Клик по группе');

})(Jane);

/* ../../blocks/abook-entries/abook-entries.js end */

/* ../../blocks/abook-entries-select/abook-entries-select.js begin */
(function(Jane) {
    var bAbookEntries = Jane.Block.create('abook-entries-select', {
        handlers: ['abook-contacts', 'abook-groups'],
        events: {
            'click .abook-entry-checkbox-controller': 'toggleContact',
            'click .abook-entry-checkbox': 'preventPropagation',
            'click .js-abook-entry': 'onContactClick',
            'click .js-abook-label': 'filterByGroup'
        },
        janeEvents: {
            'abook.contacts:selectionChange': 'checkSelected'
        }
    });

    var bAbookEntriesProto = bAbookEntries.prototype;

    bAbookEntriesProto.onhtmlinit = function(node, params) {
        var that = this;

        this.$node = $(node);
        this.isInited = true;

        this.bAbook = Jane.Block.Abook.getAbookBlock(params.type);
        this.bAbookContacts = this.bAbook.getContactsBlock();

        var cacheNode = Jane.$H('abook-contacts').getCacheByParams(params);
        this.bAbookContacts.updatePager(cacheNode.pager);

        this.addToModel = (this.params.type === 'select' ? addToSelectModel : addToGroupModel);
        this.removeFromModel = (this.params.type === 'select' ? removeFromSelectModel : removeFromGroupModel);

        this.appendContactsEmails();

        if (params.type === 'add-to-group') {
            this.$node.find('.js-abook-entry[data-type="group"]').each(function() {
                that.extendContact(this, true);
            });
        }

        Daria.SocialAvatarsAbook(this.$node.find('.abook-entries'), params);

        this.triggerMarkupChangeLazy = this.triggerMarkupChange.lazy(0);
    };

    bAbookEntriesProto.onshow = function() {
        this.checkSelected('', this.params.type);

        this.triggerMarkupChangeLazy();
    };

    bAbookEntriesProto.onhide = function() {
        this.triggerMarkupChangeLazy.reset();
    };

    bAbookEntriesProto.appendContactsEmails = function() {
        var that = this;

        this.$node.find('.abook-entry[data-type="group"]').each(function() {
            var $group = $(this);

            var cid = $group.data('cid');
            var html = Jane.tt(
                'mail-abook:abook-contact-emails',
                { tid: that.params.tid, cid: cid, type: that.params.type },
                ['abook-groups', 'abook-contacts'],
                that.params
            );

            $group.data('emails', html);
            var $emailsContainer = $(html);
            //$emailsContainer.find('.abook-entry').data('group', $group.get(0));

            $group.data('isExtended', false);
            if (Modernizr.ielt9) {
                $emailsContainer.hide();
            } else {
                $emailsContainer.css('height', 0);
            }

            $group.after(html);
        });
    };

    bAbookEntriesProto.checkSelected = function(_, abookType) {
        if (abookType !== this.params.type) {
            return;
        }

        var that = this;

        if (this.params.type === 'select') {

            this.$node.find('input[type="checkbox"]:checked').prop('checked', false);
            this.$node.find('.js-abook-entry')
                .removeClass('is-selected')
                .data('field', null)
                .find('.js-email-to-field-content').remove();

            var contactsCache = Jane.$H('abook-contacts').getCacheByParams(this.params).contact;

            var selected = this.params.selectedEmails;
            $.each(selected, function(currentField) {
                selected[currentField].forEach(function(mailObj) {

                    contactsCache.forEach(function(cacheContact) {
                        var name = cacheContact.name.full;
                        var cid = cacheContact.cid;

                        if (name === mailObj.name) {
                            cacheContact.email.forEach(function(cacheEmail) {

                                if (cacheEmail.value === mailObj.email) {

                                    var mcid = cid + '.' + cacheEmail.id;

                                    var $contactGroup = that.$node.find('.abook-entry[data-cid="' + cid + '"][data-type="group"]');
                                    if ($contactGroup.length) {
                                        $contactGroup.find('input[type="checkbox"]').prop('checked', true);
                                        $contactGroup.addClass('is-selected');
                                        // TODO: Нужно открывать группы?
                                        //that.extendContact($contactGroup, true);
                                    }

                                    var $contact = that.$node.find('.abook-entry[data-mcid="' + mcid + '"]');
                                    if ($contact.length) {
                                        $contact.find('input[type="checkbox"]').prop('checked', true);
                                        $contact.addClass('is-selected');
                                        $contact.data('field', currentField);

                                        that.appendFieldChangeControl($contact);
                                    }
                                }
                            });
                        }

                    });
                });
            });

        } else if (this.params.type === 'new-group' || this.params.type === 'add-to-group') {
            this.$node.find('input[type="checkbox"]:checked').prop('checked', false);
            this.$node.find('.js-abook-entry').removeClass('is-selected');

            this.params.selectedEmails.emails.forEach(function(mcid) {
                var cid = mcid.split('.')[0];

                var $contactGroup = that.$node.find('.abook-entry[data-cid="' + cid + '"][data-type="group"]');
                if ($contactGroup.length) {
                    $contactGroup.find('input[type="checkbox"]').prop('checked', true);
                    $contactGroup.addClass('is-selected');
                    //that.extendContact($contactGroup, true);
                }

                var $contact = that.$node.find('.abook-entry[data-mcid="' + mcid + '"]');
                if ($contact.length) {
                    $contact.find('input[type="checkbox"]').prop('checked', true);
                    $contact.addClass('is-selected');
                    that.applySelect($contact, true);
                }
            });
        }

        this.triggerMarkupChangeLazy();
    };

    bAbookEntriesProto.triggerMarkupChange = function() {
        Jane.events.trigger('abook.entries:show-lazy', this.params.type);
    };

    bAbookEntriesProto.onContactClick = function(e) {
        if ($(e.target).closest('.js-email-to-field').length) {
            return;
        }

        e.preventDefault();
        e.stopPropagation();

        var $contact = $(e.currentTarget);

        var state = $contact.has(':checked').length;

        if ($contact.data('type') === 'group') {
            var extended = $contact.data('isExtended');

            if (state) {
                this.extendContact($contact, !extended);
            } else {
                if (extended) {
                    this.extendContact($contact, false);
                } else {
                    $contact.find('input[type="checkbox"]').prop('checked', true);
                    this.toggleContact($contact);
                }
            }
        } else {
            var $checkbox = $contact.find('input[type="checkbox"]');
            $checkbox.prop('checked', !$checkbox.is(':checked'));
            this.toggleContact($contact);
        }
    };

    bAbookEntriesProto.extendContact = function(e, enable) {
        var $contact = $(e.target || e).closest('.abook-entry');
        var $emailsContainer = $($contact.data('emails'));

        if (arguments.length === 1) {
            enable = !$contact.data('isExtended');
        }

        if (enable) {
            if (Modernizr.ielt9) {
                $emailsContainer.show();
            } else {
                var height = 0;
                var $emails = $emailsContainer.children();
                // Помещаем в DOM для правильного расчета высоты блоков.
                $emails.appendTo(document.body);
                $emails.each(function() {
                    height += $(this).outerHeight();
                });
                $emails.appendTo($emailsContainer);

                $emailsContainer.css('height', height);
            }
        } else {
            if (Modernizr.ielt9) {
                $emailsContainer.hide();
            } else {
                $emailsContainer.css('height', 0);
            }
        }
        $contact.toggleClass('abook-entry_extended', enable);

        $contact.data('isExtended', enable);
    };

    bAbookEntriesProto.toggleContact = function(e) {
        var that = this;

        $(document).trigger('b-mail-dropdown-closeall');

        var $contact = $(e.currentTarget || e).closest('.abook-entry');
        var state = $contact.has(':checked').length;

        if ($contact.is('.abook-entry_group')) {
            if (state) {
                this.extendContact($contact, true);

                var $firstMail = $($contact.data('emails')).find('.js-abook-entry').eq(0);
                this.addToModel($firstMail);
            } else {
                var $emailsContainer = $($contact.data('emails'));

                $emailsContainer.find('.js-abook-entry').each(function() {
                    that.removeFromModel($(this));
                });
            }
        } else {
            if (state) {
                this.addToModel($contact);
            } else {
                this.removeFromModel($contact);
            }
        }
    };

    /**
     * Создает объект представления контакта по mcid.
     * @private
     * @param {string|number} mcid
     */
    bAbookEntriesProto.mcidToContactObject = function(mcid) {
        var hAbookContacts = Jane.$H('abook-contacts');

        var mcidParts = String(mcid).split('.');
        var cid = mcidParts[0];
        var mid = mcidParts[1];

        var contact = hAbookContacts.getContactData(cid);

        return {
            name: contact.name.full,
            email: jpath(contact, 'email[.id == "' + mid + '"]')[0].value
        };
    };


    bAbookEntriesProto.appendFieldChangeControl = function($contact) {
        var field = $contact.data('field');

        var html = Jane.tt('mail-abook:abook-contact-email-field', { selected: field });
        $(html).find('.js-abook-field-dropdown-container').data('contact', $contact.get(0));

        $contact.find('.js-field-wrapper').html(html);

        //
    };

    /**
     *
     * @param {jQuery} $contact
     * @param {boolean} visible
     * @param {string} [field]
     */
    bAbookEntriesProto.applySelect = function($contact, visible, field) {
        if (this.params.type === 'select') {
            if ($contact.data('field') !== field) {
                $contact.data('field', field);

                var html = Jane.tt('mail-abook:abook-contact-email-field', { selected: field });
                $(html).find('.js-abook-field-dropdown-container').data('contact', $contact[0]);

                $contact.find('.js-field-wrapper').html(html);
            }

            var contactEmail = this.mcidToContactObject($contact.data('mcid'));
            if (visible) {
                this.bAbookContacts.addMailToSelected(contactEmail, field);
            } else {
                this.bAbookContacts.removeMailFromSelected(contactEmail);
            }

            $contact.find('.js-email-to-field-content').toggleClass('g-hidden', !visible);
        } else {
            var mcid = $contact.data('mcid');

            if (visible) {
                this.bAbookContacts.addMcidToSelected(mcid);
            } else {
                this.bAbookContacts.removeMcidFromSelected(mcid);
            }
        }
    };

    /**
     * Чекнуть все контакты.
     */
    bAbookEntriesProto.selectAll = function() {
        var that = this;
        var $entries = this.$node.find('.abook-entries').children('.abook-entry[data-cid]');

        $entries.each(function() {
            var $contact = $(this);
            if ($contact.data('type') === 'group') {
                $contact = $($contact.data('emails')).find('.js-abook-entry').eq(0);
            }
            that.addToModel($contact);
        });
    };

    /**
     * Снять выделение.
     */
    bAbookEntriesProto.deselectAll = function() {
        var that = this;
        var $entries = this.$node.find('.abook-entry[data-mcid]');
        $entries.each(function() {
            var $contact = $(this);
            that.removeFromModel($contact);
        });
    };

    bAbookEntriesProto.preventPropagation = function(e) {
        e.stopPropagation();
    };

    /**
     * Смена группы.
     * @param {Object} e
     */
    bAbookEntriesProto.filterByGroup = function(e) {
        var groupId = String($(e.currentTarget).data('tid'));

        this.bAbook.changeGroup(groupId);

        e.preventDefault();
        e.stopPropagation();
    };


    function addToSelectModel($contactEmail) {
        var contactEmail = this.mcidToContactObject($contactEmail.data('mcid'));
        this.bAbookContacts.addMailToSelected(contactEmail, $contactEmail.data('field') || this.params.field);
    }

    function removeFromSelectModel($contactEmail) {
        var contactEmail = this.mcidToContactObject($contactEmail.data('mcid'));
        this.bAbookContacts.removeMailFromSelected(contactEmail);
    }

    function addToGroupModel($contactEmail) {
        var mcid = $contactEmail.data('mcid');
        this.bAbookContacts.addMcidToSelected(mcid);
    }

    function removeFromGroupModel($contactEmail) {
        var mcid = $contactEmail.data('mcid');
        this.bAbookContacts.removeMcidFromSelected(mcid);
    }

})(Jane);

/* ../../blocks/abook-entries-select/abook-entries-select.js end */


/* ../../blocks/abook-blocks.js end */


})(Jane, Daria);

/* abook.js end */

