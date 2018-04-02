
var Sidenote = {

    constant: {
        uuidChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        uuidLen: 22,
        marginLeft: 20,
        toolbarHeight: undefined,
    },

    state: {
        notes: [],
        editors: {},
        contents: undefined,
        numVisibleColumns: SidenoteSetup.numVisibleColumns,
        noteWidth: undefined,
        mode: SidenoteSetup.mode,
        selectedNoteDivId: undefined,
    },

    init: function() {
        $("#breadcrumbs").text("foo");
        Sidenote.initState();
        Sidenote.initTitle();
        Sidenote.positionMenu();
        Sidenote.initRootNote();
        Sidenote.initToolbarHeight();
        Sidenote.positionContainer();
        Sidenote.setMode();
    },

    initState: function() {
        Sidenote.state.noteWidth = Sidenote.noteWidth();
        Sidenote.state.contents = SidenoteSetup.contents;
        Sidenote.state.uuidToNoteName = SidenoteSetup.uuidToNoteName;
        Sidenote.state.noteNameToUuid = SidenoteSetup.noteNameToUuid;
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

    initRootNote: function() {
        const uuid = SidenoteSetup.rootUuid;
        const noteName = Sidenote.state.uuidToNoteName[uuid];
        const divId = undefined;
        const columnPosition = 0;
        const deltas = Sidenote.state.contents[uuid];

        const note = Sidenote.createNote(noteName, divId, uuid, columnPosition, deltas);
        Sidenote.noteFocusIn(note.divId);
    },

    createNoteDiv: function(divId, columnPosition) {

        html = "<div class='note' id='" + divId + "'>";
        html += "<div class='editor'></div>";
        html += "</div>";

        $("#note-container").append(html);

        Sidenote.newEditor(divId);

        const div = "#" + divId;
        const toolbarHeight = $(".ql-toolbar").outerHeight(true);
        $(div).css("top", toolbarHeight);
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

        Sidenote.positionToolbar(divId);
    },

    getColumnLeftPosition: function(columnPosition) {
        return Sidenote.state.noteWidth * columnPosition + Sidenote.constant.marginLeft;
    },

    noteFocusIn: function(divId) {
        Sidenote.state.selectedNoteDivId = divId;
        Sidenote.showToolbar(divId);
        Sidenote.bringNoteToTop(divId);
    },

    showToolbar: function(divId) {
        Sidenote.hideAllToolbars();
        $("#" + divId + " .ql-toolbar").removeClass("hidden");
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

    bringNoteToTop: function(divId) {
        for (var i = 0; i < Sidenote.state.notes.length; i++) {
            const note = Sidenote.state.notes[i];
            $("#" + note.divId).css("z-index", "0");
        }

        // Bring divId to top
        $("#" + divId).css("z-index", "1");
    },

    positionToolbar: function(divId) {
        const top = $("#title").outerHeight(true) +
                  $("#breadcrumbs").outerHeight(true);
        const toolbar = "#" + divId + " .ql-toolbar";
        $(toolbar).css("top", top);
        $(toolbar).css("left", 0);
    },

    setContents: function(note) {
        Sidenote.getEditor(note).setContents(Sidenote.state.contents[note.uuid]);
    },

    getEditor: function(note) {
        return Sidenote.state.editors[note.divId];
    },

    initToolbarHeight: function() {
        Sidenote.constant.toolbarHeight = $(".ql-toolbar").outerHeight(true);
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
            var scrollTop = $(".ql-toolbar").outerHeight(true);
            $("#note-container").scrollTop(scrollTop);
        } else {
            Sidenote.enableEditors();
            Sidenote.moveNotesDownByToolbarHeight();
            Sidenote.showAllToolbars();
            $("#modeButton").text("Presentation mode");
            var scrollTop = 0;
            $("#note-container").scrollTop(scrollTop);
        }
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

    getOrCreateUuidLink: function(link) {
        if (link in Sidenote.state.noteNameToUuid) {
            return Sidenote.state.noteNameToUuid[link];
        } else {
            const uuid = Sidenote.createUuid();
            Sidenote.state.noteNameToUuid[link] = uuid;
            Sidenote.state.uuidToNoteName[uuid] = link;
            return uuid;
        }
    },

    openNote: function(noteName, uuidLink) {
        const fromNote = Sidenote.getSelectedNote();
        Sidenote.saveDeltas(fromNote);
        const columnPosition = fromNote.columnPosition + 1;
        const newNote = Sidenote.createNote(noteName, undefined, uuidLink, columnPosition, undefined);
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
        Sidenote.state.contents[note.uuid] = editor.getContents();
    },

    createNote: function(noteName, divId, uuid, columnPosition, deltas) {

        divId = divId ? divId : Sidenote.createUuid();
        uuid = uuid ? uuid : Sidenote.createUuid();

        const note = {
            divId: divId,
            uuid: uuid,
            columnPosition: columnPosition,
        };

        const defaultDeltas =  {"ops":[{"insert": noteName},{"attributes":{"header":2},"insert":"\n"}]}
        deltas = deltas ? deltas : defaultDeltas;
        Sidenote.state.contents[note.uuid] = deltas;

        Sidenote.state.notes.push(note);
        Sidenote.createNoteDiv(note.divId, note.columnPosition);
        Sidenote.setContents(note);
        Sidenote.hideToolbar(note.divId);
        return note;
    },
}

window.onload = function() {
    Sidenote.init();
}
