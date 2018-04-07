// Public domain. Michael Gagnon, 2018.

// TODO: image modal in quill
// TODO: shifts below notes vertically when segments are edited
var Sidenote = {

    constant: {
        uuidChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        uuidLen: 22,
        marginLeft: 20,
        toolbarHeight: undefined,
        animationDuration: 400,
        triggerPrependTop: 400,
        maxLinkLength: 140,
        orig: {
            contents: undefined,
            uuidToNoteName: undefined,
            noteNameToUuid: undefined,
        },
    },

    state: {
        notes: [],
        editors: {},
        contents: undefined,
        uuidToNoteName: undefined,
        noteNameToUuid: undefined,
        numVisibleColumns: undefined,
        noteWidth: undefined,
        mode: undefined,
        selectedNoteDivId: undefined,
        segmentNames: new Set(),
        outlines: [],
    },

    init: function() {
        Sidenote.initConstant();
        Sidenote.initState();
        Sidenote.initTitle();
        Sidenote.positionMenu();
        Sidenote.initBreadcrumbs();
        Sidenote.initRootNote();
        Sidenote.positionContainer();
        Sidenote.setMode();
        Sidenote.sizeSidenoteContainerHeight();
        Sidenote.registerScroll();
        $(window).resize(Sidenote.resizeWindow);
    },

    initConstant: function() {
        Sidenote.constant.orig.contents = Sidenote.deepCopy(SidenoteSetup.contents);
        Sidenote.constant.orig.uuidToNoteName = Sidenote.deepCopy(SidenoteSetup.uuidToNoteName);
        Sidenote.constant.orig.noteNameToUuid = Sidenote.deepCopy(SidenoteSetup.noteNameToUuid);
    },

    initState: function() {
        Sidenote.state.contents = SidenoteSetup.contents;
        Sidenote.state.uuidToNoteName = SidenoteSetup.uuidToNoteName;
        Sidenote.state.noteNameToUuid = SidenoteSetup.noteNameToUuid;
        Sidenote.state.numVisibleColumns = SidenoteSetup.numVisibleColumns;
        Sidenote.state.noteWidth = Sidenote.noteWidth();
        Sidenote.state.mode = SidenoteSetup.mode;
        Sidenote.state.segmentIndex = SidenoteSetup.segmentIndex;
        Sidenote.state.currentScrollTop = $("#note-container").scrollTop();
        Sidenote.initSegmentNames();
    },

    deepCopy: function(contents) {
        return JSON.parse(JSON.stringify(contents));
    },

    noteWidth: function() {
        return ($("#note-container").width() - Sidenote.constant.marginLeft) / Sidenote.state.numVisibleColumns;
    },

    initTitle: function() {
        $("#title h1").text(SidenoteSetup.title);
        $("#title").css("margin-left", Sidenote.constant.marginLeft);
    },

    positionMenu: function() {
        const menuHeight = $("#menu").outerHeight(true);
        const titleHeight = $("#title").outerHeight(true);
        const top = (titleHeight - menuHeight) / 2;
        $("#menu").css("top", top);
    },

    initBreadcrumbs: function() {
        const top = $("#title").outerHeight(true);
        $("#breadcrumbs").css("top", top);
        Sidenote.positionBreadcrumbs();
    },

    positionBreadcrumbs: function() {
        const scrollLeft = $("#note-container").scrollLeft();
        const bcLeft = -scrollLeft;
        $("#breadcrumbs").css("left", bcLeft);
    },

    initRootNote: function() {
        const uuid = SidenoteSetup.rootUuid;
        const noteName = Sidenote.state.uuidToNoteName[uuid];
        const columnPosition = 0;

        const note = Sidenote.pushEtc(uuid, columnPosition);
        Sidenote.state.selectedNoteDivId = note.divId;
        Sidenote.noteFocusIn(note.divId);
        Sidenote.newBreadcrumb(note, columnPosition, noteName);
    },

    pushEtc: function(uuid, columnPosition) {

        const noteName = Sidenote.state.uuidToNoteName[uuid];
        const segment = Sidenote.state.segmentNames.has(noteName);

        const note = {
            divId: Sidenote.createUuid(),
            uuid: uuid,
            columnPosition: columnPosition,
            segment: segment,
        };

        Sidenote.state.notes.push(note);
        const editor = Sidenote.createNoteDiv(note.divId, note.columnPosition);
        Sidenote.editorOnChange(editor, segment, uuid, note.divId);
        Sidenote.setContents(note);
        Sidenote.hideToolbar(note.divId);
        Sidenote.slide(note);

        return note;
    },

    editorOnChange: function(editor, segment, uuid, divId) {
        if (!segment) {
            return;
        }

        editor.on('text-change', function(delta, oldDelta, source) {

            if (source === "api") {
                return;
            }

            const links = Sidenote.getSegmentLinksFromUuid(uuid);
            if (typeof links === "undefined") {
                $("#" + divId).css("background-color", "#ffe2dd");
            } else {
                $("#" + divId).css("background-color", "");
            }
        });
    },

    createNoteDiv: function(divId, columnPosition) {

        html = "<div class='note' id='" + divId + "'>";
        html += "<div class='editor'></div>";
        html += "</div>";

        $("#note-container").append(html);

        const editor = Sidenote.newEditor(divId);

        if (!Sidenote.constant.toolbarHeight) {
            Sidenote.initToolbarHeight();
        }

        const div = "#" + divId;
        const top = Sidenote.state.mode === "edit" ? Sidenote.constant.toolbarHeight : 0;
        $(div).css("top", top);
        $(div).css("width", Sidenote.state.noteWidth);
        $(div).css("left", Sidenote.getColumnLeftPosition(columnPosition));
        $("#" + divId).focusin(function(){
            Sidenote.noteFocusIn(divId);
        });

        return editor;
    },

    newEditor: function(divId) {

        const toolbaroptions = [
            [{ header: ['1', '2', '3', false] }],
            ['bold', 'italic', 'underline', 'link'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['clean'],
            ['image']];

        const editor = new Quill("#" + divId + " .editor", {
          modules: { toolbar: toolbaroptions },
          theme: "snow",
        });

        Sidenote.state.editors[divId] = editor;

        if (Sidenote.state.mode == "presentation") {
            editor.disable();
        } else {
            editor.enable();
        }

        Sidenote.positionToolbars();

        return editor;
    },

    initToolbarHeight: function() {
        Sidenote.constant.toolbarHeight = $(".ql-toolbar").outerHeight(true);
    },

    getColumnLeftPosition: function(columnPosition) {
        return Sidenote.state.noteWidth * columnPosition + Sidenote.constant.marginLeft;
    },

    noteFocusIn: function(divId) {
        Sidenote.saveSelectedNote();
        Sidenote.state.selectedNoteDivId = divId;
        Sidenote.showToolbar(divId);
        Sidenote.bringNoteToTop(divId);
    },

    saveSelectedNote: function() {
        const selectedNote = Sidenote.getSelectedNote();
        const deltas = Sidenote.saveDeltas(selectedNote);

        // There might be multiple notes with the same uuid as selectedNote.
        // So, set update their editors with the deltas of selectedNote
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            if (note.uuid === selectedNote.uuid && note.divId != selectedNote.divId) {
                const editor = Sidenote.getEditor(note);
                editor.setContents(deltas);
            }
        }

        return selectedNote;
    },

    showToolbar: function(divId) {
        if (Sidenote.state.mode === "edit") {
            Sidenote.hideAllToolbars();
            $("#" + divId + " .ql-toolbar").removeClass("hidden");
        }
    },

    hideAllToolbars: function() {
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            Sidenote.hideToolbar(note.divId);
        }
    },

    hideToolbar: function(divId) {
        $("#" + divId + " .ql-toolbar").addClass("hidden");
    },

    slide: function(toNote) {
        const cp = toNote.columnPosition;
        const leftPx = $("#" + toNote.divId).css("left");
        const left = parseInt(leftPx);
        const right = left + Sidenote.state.noteWidth;
        const leftPos = $("#sidenote-container").scrollLeft();
        $("#note-container").animate({scrollLeft: right}, { duration: Sidenote.constant.animationDuration, queue: false });
    },

    bringNoteToTop: function(divId) {
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            $("#" + note.divId).css("z-index", "0");
        }

        // Bring divId to top
        $("#" + divId).css("z-index", "1");
    },

    positionToolbars: function() {
        const top = $("#title").outerHeight(true) +
                  $("#breadcrumbs").outerHeight(true);
        $(".ql-toolbar").css("top", top);
        $(".ql-toolbar").css("left", 0);
    },

    setContents: function(note) {
        Sidenote.getEditor(note).setContents(Sidenote.state.contents[note.uuid]);
    },

    getEditor: function(note) {
        return Sidenote.state.editors[note.divId];
    },

    positionContainer: function() {
        var top = $("#title").outerHeight(true) +
            $("#breadcrumbs").outerHeight(true);

        $("#note-container").css("top", top);
        $("#note-container").css("left", 0);
    },

    setMode: function() {
        if (Sidenote.state.mode === "presentation") {
            Sidenote.state.mode = "edit";
            Sidenote.toggleMode();
        }
    },

    resizeWindow: function() {
        Sidenote.sizeSidenoteContainerHeight();
    },

    sizeSidenoteContainerHeight: function() {
        const windowHeight = $(window).outerHeight(); // TODO: true?
        const top = parseFloat($("#note-container").css("top"));
        $("#note-container").height(windowHeight - top);
    },

    initSegmentNames: function() {
        for (var i = 0; i < SidenoteSetup.segmentNames.length; i++ ){
            const segmentName = SidenoteSetup.segmentNames[i];
            Sidenote.state.segmentNames.add(segmentName);
        }
    },

    createUuid: function() {
      var uuid = "";
      for (var i = 0; i < Sidenote.constant.uuidLen; i++) {
        uuid += Sidenote.constant.uuidChars.charAt(Math.floor(Math.random() * Sidenote.constant.uuidChars.length));
      }
      // Do "x" + uuid so that uuids are always valid identifiers
      return "x" + uuid;
    },

    toggleMode: function() {
        Sidenote.state.mode = Sidenote.state.mode === "presentation" ? "edit" : "presentation";

        if (Sidenote.state.mode == "presentation") {
            Sidenote.disableEditors();
            Sidenote.moveNotesUpByToolbarHeight();
            Sidenote.hideAllToolbars();
            Sidenote.removeBreadcrumbLinks();
            $("#modeButton").text("Edit mode");
        } else {
            Sidenote.enableEditors();
            Sidenote.moveNotesDownByToolbarHeight();
            Sidenote.showAllToolbars();
            Sidenote.addBreadcrumbLinks();
            $("#modeButton").text("Presentation mode");
        }

        Sidenote.sizeSidenoteContainerHeight();
    },

    forEachEditor: function(func) {
        const editorKeys = Object.keys(Sidenote.state.editors);

        editorKeys.forEach(function(key){
            const editor = Sidenote.state.editors[key];
            func(editor);
        });

    },

    disableEditors: function() {
        Sidenote.forEachEditor(function(editor) {editor.disable() });
    },

    enableEditors: function() {
        Sidenote.forEachEditor(function(editor) {editor.enable() });
    },

    hideAllToolbars: function() {
        $(".ql-toolbar").addClass("hidden");
    },

    showAllToolbars: function() {
        $(".ql-toolbar").removeClass("hidden");
    },

    removeBreadcrumbLinks: function() {
        $("#breadcrumbs .crumbNoLink").removeClass("hidden");
        $("#breadcrumbs .crumbLink").addClass("hidden");
    },

    addBreadcrumbLinks: function() {
        $("#breadcrumbs .crumbNoLink").addClass("hidden");
        $("#breadcrumbs .crumbLink").removeClass("hidden");
    },

    repositionNotes: function(sign) {
        const delta = sign * Sidenote.constant.toolbarHeight;

        $(".note").each(function(_, note){
            const oldTop = parseFloat($(note).css("top"));
            const newTop = oldTop + delta;
            $(note).css("top", newTop);
        });

        $(".outline").each(function(_, outline){
            const oldTop = parseFloat($(outline).css("top"));
            const newTop = oldTop + delta;
            $(outline).css("top", newTop);
        });
    },

    moveNotesUpByToolbarHeight: function() {
        Sidenote.repositionNotes(-1);
    },

    moveNotesDownByToolbarHeight: function() {
        Sidenote.repositionNotes(1);
    },

    validLink: function(link) {
        return link.length <= Sidenote.constant.maxLinkLength;
    },

    createAndOpenNote: function(uuid, noteName) {
        Sidenote.state.noteNameToUuid[noteName] = uuid;
        Sidenote.state.uuidToNoteName[uuid] = noteName;
        const deltas = {"ops":[{"insert": noteName},{"attributes":{"header":2},"insert":"\n"}]}
        Sidenote.state.contents[uuid] = deltas;
        Sidenote.openNote(uuid);
    },

    saveDeltasAndGetCp: function() {
        const fromNote = Sidenote.saveSelectedNote();
        const cp = fromNote.columnPosition + 1;
        Sidenote.clearNotes(cp);
        return cp;
    },

    getSelectedNote: function() {
        for (i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            if (note.divId === Sidenote.state.selectedNoteDivId) {
                return note;
            }
        }

        throw "Could not find note";
    },

    saveDeltas: function(note) {
        const editor = Sidenote.getEditor(note);
        const deltas = editor.getContents();
        Sidenote.state.contents[note.uuid] = deltas;
        return deltas;
    },

    newBreadcrumb: function(note, columnPosition, noteName) {
        const crumbSpanId = "crumb-" + columnPosition;

        // TODOO: link to modal for this crumb
        if ($("#" + crumbSpanId).length > 0) {
            $("#" + crumbSpanId + " a").text(noteName);
        } else {
            Sidenote.positionToolbars();
            Sidenote.positionContainer();

            const containerWidth = parseFloat($("#note-container").css("width"));
            const crumbWidth = Sidenote.state.noteWidth;
            const numColumns = Sidenote.getNumColumns();
            const width = Math.max(containerWidth, numColumns * crumbWidth);
            $("#breadcrumbs").css("width", width);

            const uuid = Sidenote.state.noteNameToUuid[noteName];
            var link;
            if (note.segment) {
                link = noteName;
            } else {
                link = "<a class='crumbLink' href='javascript:Sidenote.renameNoteModal(\"" + uuid + "\")'>" + noteName + "</a>";
                link += "<span class='crumbNoLink'>" + noteName + "</span>";
            }

            $("#breadcrumbs").append('<span id="' + crumbSpanId + '" class="crumb">' + link + '</span>');

            if (Sidenote.state.mode == "edit") {
                $("#" + crumbSpanId + " .crumbNoLink").addClass("hidden");
            } else {
                $("#" + crumbSpanId + " .crumbLink").addClass("hidden");
            }

            const left = Sidenote.getColumnLeftPosition(columnPosition);
            $("#" + crumbSpanId).css("left", left);
            $("#" + crumbSpanId).css("width", crumbWidth);

            const height = $("#" + crumbSpanId).outerHeight(true);
            $("#breadcrumbs").css("height", height);
        }

        Sidenote.updateBreadcrumbs();
    },

    renameNoteModal: function(uuid) {
        $("#renameNoteModal .modal-header").html("<h2>Rename note</h2>");

        const noteName = Sidenote.state.uuidToNoteName[uuid];
        $("#renameNoteModal .modal-body").html('<input class="form-control" type="text" value="' + noteName + '">');
        
        $("#renameNoteModalSave").attr("onclick", "Sidenote.renameNoteModalSave('" + uuid + "')");

        $("#renameNoteModal").modal();
    },

    renameNoteModalSave: function(uuid) {
        const newNoteName = $("#renameNoteModal .modal-body input").val();

        if (Sidenote.getPassageFromNoteNameLink(newNoteName) || !Sidenote.validLink(newNoteName)) {
            alert("Invalid note name");
            return;
        }

        const oldNoteName = Sidenote.state.uuidToNoteName[uuid];

        Sidenote.state.uuidToNoteName[uuid] = newNoteName;
        delete Sidenote.state.noteNameToUuid[oldNoteName];
        Sidenote.state.noteNameToUuid[newNoteName] = uuid;

        var note;
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const n = Sidenote.state.notes[i];
            if (n.uuid == uuid) {
                note = n;
            }
        }
        Sidenote.newBreadcrumb(note, note.columnPosition, newNoteName);

        $("#renameNoteModal").modal("hide");
    },

    updateBreadcrumbs: function() {

        // Find the segments that are at the very top of the sidenote-container
        // view. Then update segnment name to reflect

        const segmentNotesByColumnPosition = Sidenote.getSegmentNotesByColumnPosition();
        // scrollModifier is used to ensure that we have scroll up just a little
        // bit more, to see the previous segment's name
        const scrollModifier = 100;
        for (var cp in segmentNotesByColumnPosition) {
            const notes = segmentNotesByColumnPosition[cp];
            var bottoms = {};
            for (var i = 0; i < notes.length; i++) {
                const note = notes[i];
                const top = parseFloat($("#" + note.divId).css("top"));
                const height = $("#" + note.divId).outerHeight();
                const bottom = top + height - scrollModifier;
                if (bottom >= Sidenote.state.currentScrollTop) {
                    bottoms[i] = bottom;
                }
            }

            const numBottoms = Object.keys(bottoms).length
            if (numBottoms === 0) {
                throw "Error";
            } else {
                var minI = undefined
                var minBottom = undefined;
                for (i in bottoms) {
                    if (typeof minI === "undefined") {
                        minI = i;
                        minBottom = bottoms[i]
                    } else {
                        if (bottoms[i] <= minBottom) {
                            minI = i;
                            minBottom = bottoms[i];
                        }
                    }
                }

                const segmentUuid = notes[minI].uuid;
                const segmentName = Sidenote.state.uuidToNoteName[segmentUuid];

                $("#crumb-" + cp).text(segmentName);
            }

        }
    },

    getNumColumns: function() {
        var maxColumn = 0;
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            maxColumn = Math.max(maxColumn, note.columnPosition);
        }
        return maxColumn + 1;
    },

    clearNotes: function(columnPosition) {
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            if (note.columnPosition >= columnPosition) {
                Sidenote.state.notes[i] = undefined;
                $("#" + note.divId).remove();
                $("#crumb-" + note.columnPosition).remove();
                delete Sidenote.state.editors[note.divId];
            }
        }

        Sidenote.state.notes = Sidenote.state.notes.filter(function(a){return a});

        for (var i = 0; i < Sidenote.state.outlines.length; i++) {
            const outline = Sidenote.state.outlines[i];
            if (outline.columnPosition >= columnPosition) {
                Sidenote.state.outlines[i] = undefined;
                $("#" + outline.divId).remove();
            }
        }

        Sidenote.state.outlines = Sidenote.state.outlines.filter(function(a){return a});
    },

    openNote: function(uuidLink) {
        const passage = Sidenote.getPassageFromUuidLink(uuidLink);
        const fromNote = Sidenote.saveSelectedNote();
        const columnPosition = Sidenote.saveDeltasAndGetCp();
        const newNote = Sidenote.pushEtc(passage.uuid, columnPosition);
        const fromNoteName = Sidenote.state.uuidToNoteName[fromNote.uuid];
        var top = undefined;

        if (passage.begin) {
            if (!passage.end) {
                passage.end = passage.begin;
            }

            const lineHeight = parseFloat($("#" + newNote.divId).css("line-height"))
            const passagePosition = $("#" + newNote.divId + " .ql-editor p strong:eq(" +  (passage.begin - 1) + ")").position()
            var passagePositionEnd = $("#" + newNote.divId + " .ql-editor p strong:eq(" +  (passage.end) + ")").position()
            const paraBottom = Sidenote.findParaEnd(newNote, passage);

            if (!passagePositionEnd) {
                const padding = parseFloat($(".ql-container").css("padding-bottom"));
                passagePositionEnd = {
                    top: parseFloat($("#" + newNote.divId).outerHeight()) - padding - lineHeight
                };
            }
            // This happens when the passage ends at the end of its enclosing
            // paragraph
            else if (typeof paraBottom !== "undefined") {
                passagePositionEnd = {
                    top: paraBottom - lineHeight
                };
            }

            var fromTop;
            if (Sidenote.state.segmentNames.has(fromNoteName)) {
                fromTop = Sidenote.state.currentScrollTop + Sidenote.topModifier();
            } else {
                fromTop = parseFloat($("#" + fromNote.divId).css("top"));
            }

            const newTop = fromTop - passagePosition.top;
            $("#" + newNote.divId).css("top", newTop);

            const height = passagePositionEnd.top - passagePosition.top + lineHeight;
            const left = parseFloat($("#" + newNote.divId).css("left")) - parseFloat($("#" + newNote.divId).css("margin-right")) / 2;
            const width = parseFloat($("#" + newNote.divId).css("width"));
            const outlineDivId = Sidenote.createUuid();
            const top = passagePosition.top + parseFloat($("#" + newNote.divId).css("top"));
            Sidenote.state.outlines.push({
                divId: outlineDivId,
                columnPosition: newNote.columnPosition,
            });

            var html = '<div id="' + outlineDivId + '"';
            html += 'class="outline"';
            html += 'style="top: ' + top +'px;';
            html += 'height: ' + height + 'px;';
            html += 'width: ' + width + 'px;';
            html += 'left: ' + left + 'px;"></div>';

            $("#note-container").append(html);

            // We do the +1 here so that the border for the passage outline
            // and the border for the breadcrumbs overlap precisely
            $("#note-container").scrollTop(Sidenote.state.currentScrollTop + 1);

        } else {

            if (Sidenote.state.segmentNames.has(fromNoteName)) {
                top = Sidenote.state.currentScrollTop + Sidenote.topModifier();
            } else {
                top = $("#" + fromNote.divId).css("top");
            }

            $("#note-container").scrollTop(Sidenote.state.currentScrollTop);
            $("#" + newNote.divId).css("top", top);
        }

        const noteName = Sidenote.state.uuidToNoteName[newNote.uuid];
        Sidenote.newBreadcrumb(newNote, columnPosition, noteName);
    },

    // If the passage is the last passage in a paragraph, return the y-value
    // for the bottom of the paragraph.
    findParaEnd: function(newNote, passage) {

        // find the enclosing paragraph
        const numParagraphs = $("#" + newNote.divId + " .ql-editor p").length;
        for (var i = 0; i < numParagraphs; i++) {
            const numStrongs = $("#" + newNote.divId + " .ql-editor p:eq(" + i + ") strong").length;
            for (var j = 0; j < numStrongs;j++) {
                const text = $("#" + newNote.divId  + " .ql-editor p:eq(" + i +") strong:eq(" + j + ")").text();
                if (parseInt(text) === passage.end) {
                    // We are at the end of the paragraph
                    if (j === numStrongs - 1) {
                        const para = $("#" + newNote.divId + " .ql-editor p:eq(" + i + ")");
                        const bottom = para.position().top + para.outerHeight(true);
                        return bottom;
                    }
                }
            }
        }
    },

    topModifier: function() {
        return Sidenote.state.mode == "edit" ? Sidenote.constant.toolbarHeight : 0;
    },

    registerScroll: function() {
        $("#note-container").scroll(Sidenote.onScroll);
        Sidenote.onScroll();
    },

    onScroll: function() {
        Sidenote.state.currentScrollTop = $("#note-container").scrollTop();
        Sidenote.positionBreadcrumbs();
        while (Sidenote.addNewSegment()) {}
        Sidenote.updateBreadcrumbs();
    },

    addNewSegment: function() {

        const borderNotes = Sidenote.getBorderNotes();

        // TODO: what to do if borderNotes.above and/or borderNotes.below is undefined?
        if (!borderNotes.above || !borderNotes.below) {
            throw "Error";
        }

        const aboveBorderNote = borderNotes.above;
        const aboveBorderNoteTop = parseFloat($("#" + aboveBorderNote.divId).css("top"));
        const aboveBorderTop = aboveBorderNoteTop + Sidenote.constant.triggerPrependTop;
        const aboveBorderNoteName = Sidenote.state.uuidToNoteName[aboveBorderNote.uuid];

        const belowBorderNote = borderNotes.below;
        const belowBorderNoteBottom = parseFloat($("#" + belowBorderNote.divId).css("top")) +
                                      $("#" + belowBorderNote.divId).outerHeight();
        const belowBorderBottom = belowBorderNoteBottom;
        const belowBorderNoteName = Sidenote.state.uuidToNoteName[belowBorderNote.uuid];

        const currentScrollBottom = Sidenote.state.currentScrollTop + $("#note-container").outerHeight();

        const above = Sidenote.state.segmentIndex[aboveBorderNoteName];
        const below = Sidenote.state.segmentIndex[belowBorderNoteName];

        var addedSegment = false;

        if (Sidenote.state.currentScrollTop <= aboveBorderTop
            && typeof above !== "undefined"
            && typeof above.prev !== "undefined") {

            const newNoteName = above.prev;
            const newNoteUuid = Sidenote.state.noteNameToUuid[newNoteName];

            Sidenote.prependSegment(newNoteUuid, aboveBorderNote);
            Sidenote.state.currentScrollTop = $("#note-container").scrollTop();
            addedSegment = true;
        }

        if (currentScrollBottom >= belowBorderBottom
            && typeof below !== "undefined"
            && typeof below.next !== "undefined") {

            const newNoteName = below.next;
            const newNoteUuid = Sidenote.state.noteNameToUuid[newNoteName];

            Sidenote.appendSegment(newNoteUuid, belowBorderNote);
            Sidenote.state.currentScrollTop = $("#note-container").scrollTop();
            addedSegment = true;
        }

        return addedSegment;
    },

    // Among the segments at the top of each column, which of those has a top
    // furtherest from the container top?
    getBorderNotes: function() {

        const segmentNotesByColumnPosition = Sidenote.getSegmentNotesByColumnPosition();

        var aboveTop = undefined;
        var aboveNote = undefined;

        var belowBottom = undefined;
        var belowNote = undefined;

        // Find the the lowest segment note among the top-most segments
        // for each column containing segments
        for (cp in segmentNotesByColumnPosition) {
            var notes = segmentNotesByColumnPosition[cp];

            // find the top most note for column
            var localMinTop = undefined;
            var localMinNote = undefined;

            var localMaxBottom = undefined;
            var localMaxNote = undefined;

            for (var i = 0; i < notes.length; i++) {
                const note = notes[i];
                const top = parseFloat($("#" + note.divId).css("top"));
                const noteHeight = $("#" + note.divId).outerHeight();
                const bottom = top + noteHeight;

                if (typeof localMinTop === "undefined" || top <= localMinTop) {
                    localMinTop = top;
                    localMinNote = note;
                }

                if (typeof localMaxBottom === "undefined" || bottom > localMaxBottom) {
                    localMaxBottom = bottom;
                    localMaxNote = note;
                }

            }

            if (typeof aboveTop === "undefined" || localMinTop >= aboveTop) {
                aboveTop = localMinTop;
                aboveNote = localMinNote;
            }

            if (typeof belowBottom === "undefined" || localMaxBottom <= belowBottom) {
                belowBottom = localMaxBottom;
                belowNote = localMaxNote;
            }
        }

        return {
            above: aboveNote,
            below: belowNote
        };
    },

    getSegmentNotesByColumnPosition: function() {
        var segmentNotesByColumnPosition = {};

        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            const cp = note.columnPosition;
            if (note.segment) {
                if (!(cp in segmentNotesByColumnPosition)) {
                    segmentNotesByColumnPosition[cp] = [];
                }
                segmentNotesByColumnPosition[cp].push(note);
            }
        }

        return segmentNotesByColumnPosition;
    },

    prependSegment: function(newNoteUuid, oldNote) {

        const newNote = Sidenote.pushEtc(newNoteUuid, oldNote.columnPosition);
        const divId = newNote.divId;

        const newDivHeight = parseFloat($("#" + divId).outerHeight(true));

        const top = $("#" + oldNote.divId).css("top");
        $("#" + divId).css("top", top);

        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            if (note.divId != divId) {
                const oldTop = parseFloat($("#" + note.divId).css("top"));
                const newTop = newDivHeight + oldTop;
                $("#" + note.divId).css("top", newTop);
            }
        }

        for (var i = 0; i < Sidenote.state.outlines.length; i++) {
            const outline = Sidenote.state.outlines[i];
            const oldTop = parseFloat($("#" + outline.divId).css("top"));
            const newTop = newDivHeight + oldTop;
            $("#" + outline.divId).css("top", newTop);
        }

        const newScrollTop = Sidenote.state.currentScrollTop + newDivHeight;

        $("#note-container").scrollTop(newScrollTop);
    },

    appendSegment: function(newNoteUuid, oldNote) {
        const newNote = Sidenote.pushEtc(newNoteUuid, oldNote.columnPosition);

        const oldDivTop = parseFloat($("#" + oldNote.divId).css("top"));
        const oldDivHeight = $("#" + oldNote.divId).outerHeight();
        const newDivTop = oldDivTop + oldDivHeight;

        $("#" + newNote.divId).css("top", newDivTop);
    },

    getNoteNameLink: function(uuidLink) {
        const passage = Sidenote.getPassageFromUuidLink(uuidLink);
        const noteName = Sidenote.state.uuidToNoteName[passage.uuid];

        if (!passage.begin) {
            if (passage.end) {
                throw Error;
            }
            return noteName;
        } else if (!passage.end) {
            return noteName + ":" + passage.begin;
        } else {
            return noteName + ":" + passage.begin + "-" + passage.end;
        }
    },

    getPassageFromUuidLink: function(uuidLink) {
        const parts = uuidLink.split(":");
        const uuid = parts[0];

        // Todo check with segment names
        if (parts.length == 1) {
            return {
                uuid: uuid,
                begin: undefined,
                end: undefined,
            };
        } else if (parts.length > 2) {
            throw "Error";
        } else {
            const uuid = parts[0];
            if (!(uuid in Sidenote.state.contents)) {
                throw "Error";
            }

            const noteName = Sidenote.state.uuidToNoteName[parts[0]];

            if (!Sidenote.state.segmentNames.has(noteName)) {
                throw "Error";
            }

            const beginEnd = parts[1].split("-");
            if (beginEnd.length == 1) {
                const begin = parseInt(beginEnd[0]);
                if (isNaN(begin)) {
                    throw "Error";
                } else {
                    return {
                        uuid: uuid,
                        begin: begin,
                        end: undefined
                    }
                    //return noteName + ":" + begin;
                }
            } else if (beginEnd.length > 2) {
                throw "Error";
            } else {
                const begin = parseInt(beginEnd[0]);
                const end = parseInt(beginEnd[1]);

                if (isNaN(begin) || isNaN(end)) {
                    throw "Error";
                } else if (begin != end) {
                    return {
                        uuid: uuid,
                        begin: begin,
                        end: end,
                    }
                } else {
                    return {
                        uuid: uuid,
                        begin: begin,
                        end: undefined,
                    }
                }
            }
        }
    },

    getPassageFromNoteNameLink: function(noteNamelink) {
        const parts = noteNamelink.split(":")
        if (parts.length == 1) {
            const segmentName = parts[0];
            if (Sidenote.state.segmentNames.has(segmentName)) {
                const uuid = Sidenote.state.noteNameToUuid[segmentName];
                return {
                    uuid: uuid,
                    begin: undefined,
                    end: undefined,
                }
            } else {
                return null;
            }
        } else if (parts.length == 2) {
            const segmentName = parts[0];
            if (!Sidenote.state.segmentNames.has(segmentName)) {
                return null;
            }
            const uuid = Sidenote.state.noteNameToUuid[segmentName];

            if (!uuid) {
                throw "Error";
            }

            const beginEnd = parts[1].split("-");
            // TODO: validate begin & end are within range for the segment
            // and begin <= end
            if (beginEnd.length == 1) {
                const begin = parseInt(beginEnd[0]);
                if (isNaN(begin)) {
                    return null;
                } else {
                    return {
                        uuid: uuid,
                        begin: begin,
                        end: begin,
                    }
                }
            } else if (beginEnd.length == 2) {
                const begin = parseInt(beginEnd[0]);
                const end = parseInt(beginEnd[1]);
                if (isNaN(begin) || isNaN(end)) {
                    return null;
                } else {
                    return {
                        uuid: uuid,
                        begin: begin,
                        end: end,
                    }
                }
            } else {
                return null;
            }
        } else {
            return null;
        }
    },

    getPassageForNoteName: function(noteName) {
        if (noteName in Sidenote.state.noteNameToUuid) {
            return {
                uuid: Sidenote.state.noteNameToUuid[noteName],
                begin: undefined,
                end: undefined,
            }
        } else {
            return {
                uuid: Sidenote.createUuid(),
                begin: undefined,
                end: undefined,
            }
        }
    },

    getUuidLink: function(passage) {
        if (passage.begin) {
            if (!passage.end) {
                throw "Error";
            }
            return passage.uuid + ":" + passage.begin + "-" + passage.end;
        } else {
            return passage.uuid;
        }
    },

    getSegmentLinksFromUuid: function(uuid) {
        const segmentName = Sidenote.state.uuidToNoteName[uuid];
        return Sidenote.getSegmentLinks(segmentName);
    },

    getSegmentLinks: function(segmentName) {
        if (!Sidenote.state.segmentNames.has(segmentName)) {
            throw "Error";
        }

        Sidenote.saveSelectedNote();
        const uuid = Sidenote.state.noteNameToUuid[segmentName];
        const newDeltas = Sidenote.state.contents[uuid];

        // Really this should be the orig orig---the original unalterated segment
        // before *any* edits
        const oldDeltas = Sidenote.constant.orig.contents[uuid];
        if (!newDeltas || !oldDeltas) {
            return;
        }

        // TODO: validate that the uuids in the result are actually in contents
        return Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
    },

    getSegmentLinksDeltas: function(newDeltas, oldDeltas) {

        const newOps = newDeltas.ops;
        const oldOps = oldDeltas.ops;

        if (newOps.length < oldOps.length) {
            return undefined;
        }

        const numUnits = Sidenote.getSegmentLinksHelper.getNumUnits(oldOps);

        var oldi = 0;
        var newi = 0;
        var links = [];

        // Make sure title and first new line are in order
        const headerLength = 2;
        for (; oldi < headerLength; oldi++, newi++) {
            const newOp = newOps[newi];
            const oldOp = oldOps[oldi];
            if (!Sidenote.objEquals(newOp, oldOp)) {
                return undefined;
            }
        }

        const above = 1;

        const helper = Sidenote.getSegmentLinksHelper;
        const result = helper.getPassageLink(newOps, above, newi);

        if (result) {
            links.push({passage: result.passage});
            newi = result.newi;
        } else {
            result1 = helper.getPassageLink(newOps, above, newi, "\n\n");
            if (result1) {
                result2 = helper.getPassageLink(newOps, above, result1.newi, "\n", true);
                if (result2) {
                    links.push({passage: result1.passage});
                    links.push({passage: result2.passage});
                    newi = result2.newi;
                }
            }
        }

        for (var unitNum = 1; unitNum <= numUnits; unitNum++) {
            const result = helper.parseUnit(newOps, oldOps, unitNum, newi, oldi);
            if (!result) {
                return undefined;
            } else {
                links = links.concat(result.links);
                newi = result.newi;
                oldi = result.oldi;

                if (unitNum < numUnits) {
                    const above = unitNum + 1;
                    const result2 = helper.getPassageLink(newOps, above, newi, "\n", true);
                    if (result2) {
                        links.push({passage: result2.passage});
                        newi = result2.newi;
                    }
                }
            }
        }

        if (newi === newOps.length && oldi === oldOps.length) {
            return links;
        } else {
            return undefined;
        }

    },

    testGetSegmentLinks: {

        oldDeltas: {
            "ops":[
                {"insert":"Matthew 18"},
                {"attributes":{"header":1}, "insert":"\n"},
                {"attributes":{"bold":true},"insert":"1 "},
                {"insert":"At the same time came the disciples unto Jesus, saying, Who is the greatest in the kingdom of heaven? "},
                {"attributes":{"bold":true},"insert":"2 "},
                {"insert":"And Jesus called a little child unto him, and set him in the midst of them, "},
                {"attributes":{"bold":true},"insert":"3 "},
                {"insert":"And said, Verily I say unto you, Except ye be converted, and become as little children, ye shall not enter into the kingdom of heaven. "},
            ]
        },

        // Note: these tests pretty much only test well-formed segment deltas. I.e.,
        // it does not test the various ways a segment can be malformed.
        // Therefore, when you modify the functionality of getSegmentLinksDeltas,
        // it is necessary to manually perturb these tests to make sure
        // malformed segments do not return success.
        test: function() {
            Sidenote.testGetSegmentLinks.testComplete();
            Sidenote.testGetSegmentLinks.testUnitLink();
            Sidenote.testGetSegmentLinks.testFirstAndSecondPassageLink();
            Sidenote.testGetSegmentLinks.testFirstPassageLink();
            Sidenote.testGetSegmentLinks.testGetNumUnits();
            Sidenote.testGetSegmentLinks.testNewDeltasEqualsOldDeltas();
            Sidenote.testGetSegmentLinks.testEmptyNewDeltas();
            Sidenote.testGetSegmentLinks.testBadHeader();
        },

        testComplete: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            var newDeltas = {
                "ops": [
                    oldDeltas.ops[0],
                    oldDeltas.ops[1],
                    {insert: "\n"},
                    {"attributes":{"link":"javascript:Sidenote.openNote('link1')"},"insert":"foo1"},
                    {insert: "\n\n"},
                    {"attributes":{"link":"javascript:Sidenote.openNote('link2')"},"insert":"foo2"},
                    {insert: "\n"},
                    {"attributes":{"bold":true,"link":"javascript:Sidenote.openNote('uuid1')"}, "insert":"1 "},
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    // Test skipSpace
                    {"attributes":{"bold":true,"link":"javascript:Sidenote.openNote('uuid2')"}, "insert":"3"},
                    {"insert": " "},
                    oldDeltas.ops[7],
                ],
            };

            const result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(result.length === 4);
            const passage1 = { passage :{above: 1, text: "foo1", uuid: "link1"}};
            const passage2 = { passage :{above: 1, text: "foo2", uuid: "link2"}};
            const unit1 = {unit:{at: 1, uuid: "uuid1"}};
            const unit2 = {unit:{at: 3, uuid: "uuid2"}};

            assert(Sidenote.objEquals(result[0], passage1));
            assert(Sidenote.objEquals(result[1], passage2));
            assert(Sidenote.objEquals(result[2], unit1));
            assert(Sidenote.objEquals(result[3], unit2));
        },

        testUnitLink: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            var newDeltas = {
                "ops": [
                    oldDeltas.ops[0],
                    oldDeltas.ops[1],
                    {"attributes":{"bold":true,"link":"javascript:Sidenote.openNote('uuid1')"}, "insert":"1 "},
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    oldDeltas.ops[6],
                    oldDeltas.ops[7],
                ],
            };

            const result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(result.length === 1)
            const unit = {unit:{at: 1, uuid: "uuid1"}};
            assert(Sidenote.objEquals(result[0], unit));
        },

        testFirstAndSecondPassageLink: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            var newDeltas = {
                "ops": [
                    oldDeltas.ops[0],
                    oldDeltas.ops[1],
                    {insert: "\n"},
                    {"attributes":{"link":"javascript:Sidenote.openNote('link1')"},"insert":"foo1"},
                    {insert: "\n\n"},
                    {"attributes":{"link":"javascript:Sidenote.openNote('link2')"},"insert":"foo2"},
                    {insert: "\n"},
                    oldDeltas.ops[2],
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    oldDeltas.ops[6],
                    oldDeltas.ops[7],
                ],
            };

            const result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(result.length === 2)
            const passage1 = { passage :{above: 1, text: "foo1", uuid: "link1"}};
            const passage2 = { passage :{above: 1, text: "foo2", uuid: "link2"}};
            assert(Sidenote.objEquals(result[0], passage1));
            assert(Sidenote.objEquals(result[1], passage2));
        },

        testFirstPassageLink: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            var newDeltas = {
                "ops": [
                    oldDeltas.ops[0],
                    oldDeltas.ops[1],
                    {insert: "\n"},
                    {"attributes":{"link":"javascript:Sidenote.openNote('xkcMQV7OR9Pwt4htwsZGa2M')"},"insert":"foo"},
                    {insert: "\n"},
                    oldDeltas.ops[2],
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    oldDeltas.ops[6],
                    oldDeltas.ops[7],
                ],
            };

            const result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(result.length === 1)
            const passage = { passage :{above: 1, text: "foo", uuid: "xkcMQV7OR9Pwt4htwsZGa2M"}}
            assert(Sidenote.objEquals(result[0], passage));
        },

        testGetNumUnits: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            const getNumUnits = Sidenote.getSegmentLinksHelper.getNumUnits;
            assert(getNumUnits(oldDeltas.ops) === 3);
        },

        testNewDeltasEqualsOldDeltas: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            const newDeltas = Sidenote.deepCopy(oldDeltas);
            const result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(result.length == 0);
        },

        testEmptyNewDeltas: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            const newDeltas = {"ops":[]};
            const result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(typeof result === "undefined");
        },

        testBadHeader: function() {
            const assert = Sidenote.testGetSegmentLinks.assert;
            const oldDeltas = Sidenote.testGetSegmentLinks.oldDeltas;
            var newDeltas = {
                "ops": [
                    oldDeltas.ops[0],
                    {"attributes":{"header":1}, "insert":"bad"},
                    oldDeltas.ops[2],
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    oldDeltas.ops[6],
                    oldDeltas.ops[7],
                ],
            };

            var result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(typeof result === "undefined");

            newDeltas = {
                "ops": [
                    {"insert":"bad"},
                    oldDeltas.ops[1],
                    oldDeltas.ops[2],
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    oldDeltas.ops[6],
                    oldDeltas.ops[7],
                ],
            };
            result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(typeof result === "undefined");

            newDeltas = {
                "ops": [
                    oldDeltas.ops[0],
                    {"attributes":{"header":2}, "insert":"\n"},
                    oldDeltas.ops[2],
                    oldDeltas.ops[3],
                    oldDeltas.ops[4],
                    oldDeltas.ops[5],
                    oldDeltas.ops[6],
                    oldDeltas.ops[7],
                ],
            };
            result = Sidenote.getSegmentLinksDeltas(newDeltas, oldDeltas);
            assert(typeof result === "undefined");
        },

        assert: function(bool){
            if (!bool) {
                throw "Test failed";
            }
        }

    },

    getSegmentLinksHelper: {

        getNumUnits: function(ops) {
            var numUnits = 0;

            for (var i = 0; i < ops.length; i++) {
                const op = ops[i];
                if ("attributes" in op && "bold" in op.attributes) {
                    numUnits++;
                }
            }

            return numUnits;
        },

        parseUnit: function(newOps, oldOps, unitNum, newi, oldi) {
            newi = Sidenote.getSegmentLinksHelper.skipSpace(newi, newOps);

            const newIdentifier = newOps[newi];
            const oldIdentifier = oldOps[oldi];

            const links = [];

            if (!Sidenote.getSegmentLinksHelper.validOldIdentifier(unitNum, oldIdentifier)) {
                throw "Error";
            }

            const result = Sidenote.getSegmentLinksHelper.getUuidFromNewIdentifier(unitNum, newIdentifier)
            if (!result.valid) {
                return undefined;
            } else if (result.uuid) {
                links.push({
                    unit: {
                        at: unitNum,
                        uuid: result.uuid
                    }
                });
            }

            newi++;
            oldi++;

            newi = Sidenote.getSegmentLinksHelper.skipSpace(newi, newOps);

            const newText = newOps[newi];
            const oldText = oldOps[oldi];

            if (!Sidenote.getSegmentLinksHelper.validUnitText(newText, oldText)) {
                return undefined;
            }

            newi++;
            oldi++;

            return {
                newi: newi,
                oldi: oldi,
                links: links,
            };
        },

        skipSpace: function(newi, newOps) {
            const op = newOps[newi];
            if (op && "insert" in op && (op.insert === " " || op.insert === String.fromCharCode(160))) {
                return newi + 1;
            } else {
                return newi;
            }
        },

        validOldIdentifier: function(unitNum, op) {
            const keys = Object.getOwnPropertyNames(op);
            if (keys.length != 2 ||
                !("attributes" in op) ||
                !("insert" in op)) {
                return false;
            } else {
                const keys = Object.getOwnPropertyNames(op.attributes);
                if (keys.length != 1 ||
                    !("bold" in op.attributes ) ||
                    op.attributes.bold !== true) {
                    return false;
                }
                return op.insert.trim() === unitNum.toString();
            }
        },

        getUuidFromNewIdentifier: function(unitNum, op) {
            if (Sidenote.getSegmentLinksHelper.validOldIdentifier(unitNum, op)) {
                return {valid: true, uuid: undefined};
            } else {
                return Sidenote.getSegmentLinksHelper.extractUuidFromIdentifier(unitNum, op);
            }
        },

        extractUuidFromIdentifier: function(unitNum, op) {
            const keys = Object.getOwnPropertyNames(op);
            if (keys.length != 2 ||
                !("attributes" in op) ||
                !("insert" in op)) {
                return {valid: false, uuid: undefined};
            } else {
                const keys = Object.getOwnPropertyNames(op.attributes);
                if (keys.length != 2 ||
                    !("bold" in op.attributes) ||
                    !("link" in op.attributes) ||
                    op.attributes.bold !== true) {
                    return {valid: false, uuid: undefined};
                }

                if (op.insert.trim() !== unitNum.toString())  {
                    return {valid: false, uuid: undefined};
                }

                const uuid = Sidenote.getSegmentLinksHelper.getUuidFromLink(op.attributes.link);

                if (uuid) {
                    return {valid: true, uuid: uuid};
                } else {
                    return {valid: false, uuid: undefined};
                }
            }
        },

        extractUnitText: function(op) {
            const keys = Object.getOwnPropertyNames(op);
            if (keys.length != 1 ||
                !("insert" in op)) {
                return undefined;
            }

            return op.insert.trim();
        },

        validUnitText: function(newOp, oldOp) {
            const newText = Sidenote.getSegmentLinksHelper.extractUnitText(newOp);
            const oldText = Sidenote.getSegmentLinksHelper.extractUnitText(oldOp);

            if (typeof oldText === "undefined") {
                throw "Error";
            } else if (typeof newText === "undefined" || newText !== oldText) {
                return false;
            } else {
                return true;
            }

        },

        getPassageLink: function(newOps, above, newi, newLines, skipFirstNewLine) {
            if (typeof newLines === "undefined") {
                newLines = "\n";
            }

            // If there is a newline...
            if (skipFirstNewLine || Sidenote.objEquals(newOps[newi], {"insert":"\n"})) {

                if (!skipFirstNewLine ) {
                    newi++;
                }

                // ...there must be  a link...
                const result = Sidenote.getSegmentLinksHelper.getVerseCommentaryLinkFromOp(above, newOps[newi])
                if (result) {
                    newi++;
                    // ...followed by a newline
                    if (Sidenote.objEquals(newOps[newi], {"insert":newLines})) {
                        newi++;
                        return {
                            newi: newi,
                            passage: result,
                        }
                    } else {
                        return undefined;
                    }
                } else {
                    return undefined;
                }
            } else {
                return undefined;
            }
        },

        getVerseCommentaryLinkFromOp: function(above, op) {
            const keys = Object.getOwnPropertyNames(op);
            if (keys.length != 2 ||
                !("attributes" in op) ||
                !("insert" in op)) {
                return undefined;
            } else {
                const text = Sidenote.getSegmentLinksHelper.getVerseCommentaryLinkText(op.insert);
                const uuid = Sidenote.getSegmentLinksHelper.getVerseCommentaryLinkUuid(op.attributes);

                if (!text || !uuid) {
                    return undefined;
                } else {
                    return {
                        above: above,
                        text: text,
                        uuid: uuid,
                    }
                }
            }
        },

        getVerseCommentaryLinkText: function(insert) {
            const MAX_LINK_LEN = 50;

            // TODO: search for new lines and other bad chars?
            if (insert.length <= MAX_LINK_LEN) {
                return insert;
            } else {
                return undefined;
            }
        },

        getVerseCommentaryLinkUuid: function(attributes) {
            const keys = Object.getOwnPropertyNames(attributes);
            if (keys.length != 1 ||
                !("link" in attributes)) {
                return undefined;
            }

            return Sidenote.getSegmentLinksHelper.getUuidFromLink(attributes.link);
        },

        // Does not validate that uuid is in contents
        getUuidFromLink: function(link) {
            if (!link.startsWith("javascript:Sidenote.openNote('"))
            {
                return undefined;
            }

            const parts = link.split("'");
            if (parts.length != 3 || parts[2] != ")") {
                return undefined;
            }

            const uuid = parts[1];

            return uuid;
        },
    },

    objEquals: function(obj1, obj2) {
        const keys1 = Object.getOwnPropertyNames(obj1);
        const keys2 = Object.getOwnPropertyNames(obj2);

        if (keys1.length != keys2.length) {
            return false;
        }

        for (var i = 0; i < keys1.length; i++) {
            const key = keys1[i];

            if (!(key in obj2)) {
                return false;
            }

            const v1 = obj1[key];
            const v2 = obj2[key];

            if (typeof v1 !== typeof v2) {
                return false;
            }

            if (typeof v1 === "object") {
                if (!Sidenote.objEquals(v1, v2)) {
                    return false;
                }
            } else if (v1 !== v2) {
                return false;
            }
        }

        return true;
    }
}

window.onload = function() {
    Sidenote.init();
    Sidenote.testGetSegmentLinks.test();
}
