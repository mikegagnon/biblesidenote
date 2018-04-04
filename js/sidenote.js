// Public domain. Michael Gagnon, 2018.

// TODO: image modal in quill

var Sidenote = {

    constant: {
        uuidChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        uuidLen: 22,
        marginLeft: 20,
        toolbarHeight: undefined,
        animationDuration: 400,
        triggerPrependTop: 400,
    },

    state: {
        notes: [],
        editors: {},
        contents: undefined,
        uuidToNoteName: undefined,
        noteNameToUuid: undefined,
        numVisibleColumns: SidenoteSetup.numVisibleColumns,
        noteWidth: undefined,
        mode: SidenoteSetup.mode,
        selectedNoteDivId: undefined,
        segmentNames: new Set(),
        outlines: [],
    },

    init: function() {
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

    initState: function() {
        Sidenote.state.noteWidth = Sidenote.noteWidth();
        Sidenote.state.contents = SidenoteSetup.contents;
        Sidenote.state.uuidToNoteName = SidenoteSetup.uuidToNoteName;
        Sidenote.state.noteNameToUuid = SidenoteSetup.noteNameToUuid;
        Sidenote.state.segmentIndex = SidenoteSetup.segmentIndex;
        Sidenote.initSegmentNames();
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
        Sidenote.createNoteDiv(note.divId, note.columnPosition);
        Sidenote.setContents(note);
        Sidenote.hideToolbar(note.divId);
        Sidenote.slide(note);
        Sidenote.newBreadcrumb(columnPosition, noteName);

        return note;
    },

    createNoteDiv: function(divId, columnPosition) {

        html = "<div class='note' id='" + divId + "'>";
        html += "<div class='editor'></div>";
        html += "</div>";

        $("#note-container").append(html);

        Sidenote.newEditor(divId);

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
            $("#modeButton").text("Edit mode");
        } else {
            Sidenote.enableEditors();
            Sidenote.moveNotesDownByToolbarHeight();
            Sidenote.showAllToolbars();
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

    validLink: function() {
        return true;
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

    newBreadcrumb: function(columnPosition, noteName) {
        const crumbSpanId = "crumb-" + columnPosition;

        if ($("#" + crumbSpanId).length > 0) {
            $("#" + crumbSpanId).text(noteName);
            return;
        }

        Sidenote.positionToolbars();
        Sidenote.positionContainer();

        const containerWidth = parseFloat($("#note-container").css("width"));
        const crumbWidth = Sidenote.state.noteWidth;
        const numColumns = Sidenote.getNumColumns();
        const width = Math.max(containerWidth, numColumns * crumbWidth);
        $("#breadcrumbs").css("width", width);


        $("#breadcrumbs").append('<span id="' + crumbSpanId + '" class="crumb">' + noteName + '</span>');

        const left = Sidenote.getColumnLeftPosition(columnPosition);
        $("#" + crumbSpanId).css("left", left);
        $("#" + crumbSpanId).css("width", crumbWidth);

        const height = $("#" + crumbSpanId).outerHeight(true);
        $("#breadcrumbs").css("height", height);
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
            const noteName = parts[0];
            return Sidenote.getPassageForNoteName(noteName);
        } else if (parts.length == 2) {
            const segmentName = parts[0];
            if (!Sidenote.state.segmentNames.has(segmentName)) {
                return null;
            }
            const uuid = Sidenote.state.noteNameToUuid[segmentName];
            const beginEnd = parts[1].split("-");
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
    }


}

window.onload = function() {
    Sidenote.init();
}
