/**
 * Editor widget "appSimArea": draw the task/highlight area directly on the step screenshot.
 * Drag = rectangle, single click = round tap area. Values are fractions (0–1) of the screenshot.
 */
H5PEditor.widgets.appSimArea = H5PEditor.AppSimArea = (function ($) {
  'use strict';

  var T = {
    de: {
      help: 'Auf dem Screenshot einen Bereich aufziehen. Ein einzelner Klick setzt einen runden Tippbereich.',
      noShot: 'Noch kein Screenshot. Lade oben im Schritt einen Screenshot hoch (oder in einem vorherigen Schritt).',
      inherited: 'Screenshot aus einem vorherigen Schritt',
      rect: 'Rechteck',
      ellipse: 'Kreis',
      zoom: 'Größer anzeigen'
    },
    en: {
      help: 'Drag on the screenshot to draw the area. A single click sets a round tap area.',
      noShot: 'No screenshot yet. Upload one in this step (or in a previous step).',
      inherited: 'Screenshot of a previous step',
      rect: 'Rectangle',
      ellipse: 'Circle',
      zoom: 'Show larger'
    }
  };
  function t(key) {
    var lang = (H5PEditor.contentLanguage || H5PEditor.defaultLanguage || 'en').slice(0, 2);
    return (T[lang] || T.en)[key];
  }
  function round(n) {
    return Math.round(Math.max(0, Math.min(1, n)) * 10000) / 10000;
  }

  function AppSimArea(parent, field, params, setValue) {
    var self = this;
    this.parent = parent;
    this.field = field;
    this.setValue = setValue;
    this.params = params && typeof params.x === 'number' ? params : null;

    this.$container = $(
      '<div class="field appsim-area">' +
        '<div class="h5peditor-label-wrapper"><span class="h5peditor-label"></span></div>' +
        '<div class="h5peditor-field-description appsim-area-help"></div>' +
        '<div class="appsim-area-tools">' +
          '<button type="button" class="h5peditor-button appsim-shape" data-shape="rect"></button>' +
          '<button type="button" class="h5peditor-button appsim-shape" data-shape="ellipse"></button>' +
          '<button type="button" class="h5peditor-button appsim-zoom"></button>' +
          '<span class="appsim-area-readout"></span>' +
        '</div>' +
        '<div class="appsim-area-stage"><img alt="" draggable="false"><div class="appsim-area-box"></div></div>' +
        '<div class="appsim-area-empty"></div>' +
        '<div class="appsim-area-note"></div>' +
      '</div>'
    );
    this.$container.find('.h5peditor-label').text(field.label || '');
    this.$container.find('.appsim-area-help').text(t('help'));
    this.$container.find('[data-shape=rect]').text(t('rect'));
    this.$container.find('[data-shape=ellipse]').text(t('ellipse'));
    this.$container.find('.appsim-zoom').text(t('zoom'));
    this.$container.find('.appsim-area-empty').text(t('noShot'));
    this.$stage = this.$container.find('.appsim-area-stage');
    this.$img = this.$stage.find('img');
    this.$box = this.$stage.find('.appsim-area-box');
    this.$readout = this.$container.find('.appsim-area-readout');
    this.$note = this.$container.find('.appsim-area-note');

    this.$container.find('.appsim-shape').on('click', function () {
      var shape = $(this).data('shape');
      if (!self.params) self.params = { shape: shape, x: 0.35, y: 0.45, w: 0.3, h: 0.06 };
      self.params.shape = shape;
      self.save();
    });
    this.$container.find('.appsim-zoom').on('click', function () {
      self.$stage.toggleClass('is-large');
    });

    // drawing
    var start = null;
    function pos(e) {
      var r = self.$stage[0].getBoundingClientRect();
      var p = e.touches ? e.touches[0] : e;
      return { x: (p.clientX - r.left) / r.width, y: (p.clientY - r.top) / r.height };
    }
    this.$stage.on('mousedown touchstart', function (e) {
      if (!self.$img.attr('src')) return;
      e.preventDefault();
      start = pos(e);
      self.drag = { x: start.x, y: start.y, w: 0, h: 0 };
    });
    $(document).on('mousemove touchmove', function (e) {
      if (!start) return;
      var p = pos(e);
      self.drag = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) };
      self.paint(self.drag, (self.params && self.params.shape) || 'rect');
    });
    $(document).on('mouseup touchend', function (e) {
      if (!start) return;
      var d = self.drag;
      start = null;
      var shape = (self.params && self.params.shape) || 'rect';
      var ratio = self.ratio();
      if (!d || (d.w < 0.015 && d.h < 0.015)) {
        // click → round tap area around the point (about 12 % of the screen width)
        var rw = 0.12;
        var rh = rw * ratio;
        d = { x: d.x - rw / 2, y: d.y - rh / 2, w: rw, h: rh };
        shape = 'ellipse';
      }
      self.params = { shape: shape, x: round(d.x), y: round(d.y), w: round(Math.min(d.w, 1 - d.x)), h: round(Math.min(d.h, 1 - d.y)) };
      self.save();
    });

    this.watchScreenshot();
  }

  // Width / height of the screenshot (to keep tap circles round).
  AppSimArea.prototype.ratio = function () {
    var img = this.$img[0];
    return img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 9 / 19.5;
  };

  // Finds the "screenshot" field of the step this area belongs to (also from inside hint lists).
  AppSimArea.prototype.findShotField = function () {
    var p = this.parent;
    for (var level = 0; p && level < 6; level++, p = p.parent) {
      var f = H5PEditor.findField('screenshot', p);
      if (f) return { field: f, step: p };
    }
    return null;
  };

  // Screenshot of an earlier step (steps without own screenshot reuse the previous one).
  AppSimArea.prototype.inheritedShot = function (stepParams) {
    var p = this.parent;
    var chaptersList = null;
    for (var level = 0; p && level < 10; level++, p = p.parent) {
      if (p.field && p.field.name === 'chapters' && typeof p.getValue === 'function') {
        chaptersList = p;
        break;
      }
    }
    if (!chaptersList) return null;
    var last = null;
    var chapters = chaptersList.getValue() || [];
    for (var c = 0; c < chapters.length; c++) {
      var steps = (chapters[c] && chapters[c].steps) || [];
      for (var s = 0; s < steps.length; s++) {
        if (steps[s] === stepParams) return last;
        if (steps[s] && steps[s].screenshot && steps[s].screenshot.path) last = steps[s].screenshot;
      }
    }
    return null;
  };

  AppSimArea.prototype.watchScreenshot = function () {
    var self = this;
    var found = this.findShotField();
    var update = function () {
      var own = found && found.field.params && found.field.params.path ? found.field.params : null;
      var shot = own || (found ? self.inheritedShot(found.step.params) : null);
      self.$note.text(!own && shot ? t('inherited') : '');
      if (!shot) {
        self.$img.removeAttr('src');
        self.$container.addClass('no-shot');
        return;
      }
      self.$container.removeClass('no-shot');
      var src = H5P.getPath(shot.path, H5PEditor.contentId);
      if (self.$img.attr('src') !== src) self.$img.attr('src', src);
      self.paint(self.params, self.params && self.params.shape);
    };
    if (found) found.field.changes.push(update);
    this.$img.on('load', function () {
      self.paint(self.params, self.params && self.params.shape);
    });
    // Previous steps may change while the form is open; refresh when the widget becomes visible.
    this.$container.on('mouseenter', update);
    update();
  };

  AppSimArea.prototype.paint = function (a, shape) {
    if (!a) {
      this.$box.hide();
      this.$readout.text('');
      return;
    }
    this.$box.show().toggleClass('is-round', shape === 'ellipse').css({
      left: a.x * 100 + '%',
      top: a.y * 100 + '%',
      width: a.w * 100 + '%',
      height: a.h * 100 + '%'
    });
    this.$readout.text('x ' + Math.round(a.x * 100) + ' %, y ' + Math.round(a.y * 100) + ' %, ' + Math.round(a.w * 100) + ' × ' + Math.round(a.h * 100) + ' %');
    this.$container.find('.appsim-shape').removeClass('is-active').filter('[data-shape=' + (shape || 'rect') + ']').addClass('is-active');
  };

  AppSimArea.prototype.save = function () {
    this.setValue(this.field, this.params);
    this.paint(this.params, this.params.shape);
  };

  AppSimArea.prototype.appendTo = function ($wrapper) {
    this.$container.appendTo($wrapper);
  };
  AppSimArea.prototype.validate = function () {
    return true;
  };
  AppSimArea.prototype.remove = function () {
    this.$container.remove();
  };

  return AppSimArea;
})(H5P.jQuery);
