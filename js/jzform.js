define([
    'require',
    'underscore',
    'jquery',
    'backbone'
], function(require, _, $, Backbone) {
    var jzFormElement = function(form, params) {
        var defaults = {
        };

        this.form = form;
        this.params = $.extend(defaults, params);
        this.initialize();
    };

    _.extend(jzFormElement.prototype, Backbone.Events, {
        filters: null,
        validators: null,
        initialize: function() {
            this.prepareFilters();
            this.prepareValidators();
            this.getInput();
        },
        prepareFilters: function() {
            var that = this;

            this.filters = [];
            $.each(this.params.filters, function(index, params) {
                var name = './filter/' + params.name + '.js';
                var url = require.toUrl(name);

                require([url], function(Filter) {
                    var filter = new Filter(params.options);
                    that.filters.push(filter);
                });
            });
        },
        prepareValidators: function() {
            var that = this;

            this.validators = [];
            $.each(this.params.validators, function(index, params) {
                var name = './validator/' + params.name + '.js';
                var url = require.toUrl(name);
                params.options.element = that;

                require([url], function(Validator) {
                    var validator = new Validator(params.options, params.messages);
                    that.validators.push(validator);
                });
            });
        },
        getInput: function() {
            if (!this.input && this.params.name) {
                var selector = '*[name="' + this.params.name + '"]';
                var $elements = this.form.$el.find(selector);
                this.input = ($elements.length > 0) ? $elements : false;

                if (this.input) {
                    this.bindEvents();
                }
            }

            return this.input;
        },
        bindEvents: function() {
            var input = this.getInput();

            if (input) {
                var that = this;
                input.bind('focus blur change keydown keyup paste', function(e) {
                    that.trigger(e.type, e);
                    that.form.trigger(e.type + ':' + that.params.name);
                });

                this.on('change', this.filter, this);
                this.on('change', this.validate, this);
            }
        },
        filter: function() {
            var input = this.getInput();

            if (input) {
                var currentValue = input.val();
                var filteredValue = currentValue;

                $.each(this.filters, function(index, filter) {
                    filteredValue = filter.filter(filteredValue);
                });

                input.val(filteredValue);
            }
        },
        validate: function() {
            var isValid = this.isValid();
            this.getTarget().toggleClass('invalid', !isValid);
            this.renderMessages();

            return isValid;
        },
        getValue: function() {
            var input = this.getInput();

            if (input && (input.attr('type') === 'radio' || input.attr('type') === 'checkbox')) {
                input = input.filter(':checked');

                if (input.length > 1) {
                    var values = [];
                    input.each(function(index, element) {
                        values.push($(element).val());
                    });

                    return values;
                } else {
                    return input.val();
                }
            } else {
                return (input) ? input.val() : '';
            }
        },
        setValue: function(value) {
            var input = this.getInput();
            if (input) {
                input.val(value);
                this.filter();
            }
        },
        renderMessages: function() {
            if (!this.params.renderMessages) {
                return;
            }

            var target = this.getTarget();
            var messages = target.find('.messages');
            if (messages.length === 0) {
                target.append('<div class="messages"></div>');
                messages = target.find('.messages');
            }

            messages.empty();
            $.each(this.messages, function(index, message) {
                messages.append('<p>' + message + '</p>');
            });
        },
        isValid: function() {
            this.messages = [];
            var currentValue = this.getValue();
            var valid = true;

            var that = this;
            $.each(this.validators, function(index, validator) {
                valid = (valid && validator.isValid(currentValue, that.form));

                if (!valid && validator.message) {
                    that.messages.push(validator.message);
                }
            });

            return valid;
        },
        getTarget: function() {
            var input = this.getInput();
            return (input) ? input.parent('div.element, fieldset') : this.form.$el;
        }
    });

    var jzForm = function(element, params) {
        var defaults = {
            stopOnFirstError: false,
            element: {
                renderMessages: true
            }
        };

        this.$el = $(element);
        this.params = _.extend(defaults, params);
        this.initialize();
    };

    _.extend(jzForm.prototype, Backbone.Events, {
        elements: {},
        messages: [],
        initialize: function() {
            this.prepareElements();
            this.bindEvents();
        },
        prepareElements: function() {
            var that = this;
            $.each(this.params.form.elements, function(name, params) {
                var options = $.extend(that.params.element, params);

                var element = that.elements[name] = new jzFormElement(that, options);
                that.listenToElementEvents.call(that, element);
            });
        },
        bindEvents: function() {
            var that = this;
            this.$el.bind('submit', function(e) {
                that.submit.call(that, e);
            });
        },
        listenToElementEvents: function(element) {
            element.on('all', function(name) {
                var args = $.makeArray(arguments);
                args.shift();
                args.unshift(element);
                args.unshift('element:' + name);
                this.trigger.apply(this, args);
            }, this);
        },
        getValues: function() {
            var values = {};
            $.each(this.elements, function(name, element) {
                values[name] = element.getValue();
            });

            return values;
        },
        validate: function() {
            var isValid = this.isValid();
            this.$el.toggleClass('invalid', !isValid);

            return isValid;
        },
        isValid: function() {
            var valid = true;
            var stopOnFirstError = this.params.stopOnFirstError;

            $.each(this.elements, function(name, element) {
                if (stopOnFirstError) {
                    valid = (valid && element.validate.call(element));
                } else {
                    valid = (element.validate.call(element) && valid);
                }
            });

            return valid;
        },
        reset: function() {
            this.$el.get(0).reset();
        },
        submit: function(e) {
            this.messages = [];
            this.trigger('before:submit');

            if (this.validate()) {
                var data = this.getValues();
                this.trigger('submit', e, data);
            } else {
                e.preventDefault();
            }
        },
        buildElementsFromCollection: function(fieldset, collection) {
            var $fieldset = $(fieldset);
            var template = $fieldset.find('span').attr('data-template');
            template = template.replace(/\[__remove__\]/g, '');

            collection.each(function(resource, index) {
                var data = {
                    index: index,
                    model: resource.toJSON()
                };

                var html = _.template(template, data, {
                    interpolate: /__(.+?)__/g
                });

                $fieldset.append(html);
            });
        },
        bindModel: function(model) {
            this.model = model;
            this.bindModelPopulate(model);
            this.bindModelSubmit(model);
        },
        bindModelPopulate: function(model) {
            model.on('change', function() {
                this.populate(model.toJSON());
            }, this);

            this.populate(model.toJSON());
        },
        bindModelSubmit: function(model) {
            this.on('submit', function(e) {
                e.preventDefault();
                var that = this;

                var isNew = model.isNew();
                model.save(this.getValues(), {
                    success: function() {
                        if (isNew) {
                            Copia.notice('success', 'Successfully created __model__', 10);
                            that.reset();
                        } else {
                            Copia.notice('success', 'Successfully updated __model__', 10);
                        }
                    },
                    error: function(model, fail) {
                        var response = JSON.parse(fail.responseText);

                        if (response['error-message']) {
                            that.addMessage(response['error-message']);
                            that.renderMessages();
                        } else {
                            Copia.notice('fail', 'Failed saving __model__');
                            console.log('response', response);
                        }
                    }
                });
            }, this);
        },
        populate: function(data) {
            var that = this;
            $.each(data, function(key, value) {
                var element = that.elements[key];
                if (element) {
                    element.setValue(value);
                }
            });
        },
        renderMessages: function() {
            var target = this.$el;
            var messages = target.find('> .messages');
            if (messages.length === 0) {
                target.prepend('<div class="messages"></div>');
                messages = target.find('> .messages');
            }

            messages.empty();
            $.each(this.messages, function(index, message) {
                messages.append('<p>' + message + '</p>');
            });
        },
        addMessage: function(message) {
            if (typeof(this.messages) !== 'array') {
                this.messages = [];
            }

            this.messages.push(message);
        }
    });

    return jzForm;
});