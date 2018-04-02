
var Sidenote = {

    constant: {
        uuidChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        uuidLen: 22,
        marginLeft: 20,
        toolbarHeight: undefined,
    },

    state: {
        nextNoteNumber: 0,
        notes: [],
        editors: {},
        contents: undefined,
        numVisibleColumns: SidenoteSetup.numVisibleColumns,
        noteWidth: undefined,
        mode: SidenoteSetup.mode,
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

    noteWidth: function() {
        return ($("#note-container").width() - Sidenote.constant.marginLeft) / Sidenote.state.numVisibleColumns;
    },

    initState: function() {
        Sidenote.state.noteWidth = Sidenote.noteWidth();
        Sidenote.state.contents = SidenoteSetup.contents;
        Sidenote.state.uuidToNoteName = SidenoteSetup.uuidToNoteName;
        Sidenote.state.noteNameToUuid = SidenoteSetup.noteNameToUuid
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

        const divId = "note-" + Sidenote.state.nextNoteNumber++;

        const rootNote = {
            divId: divId,
            uuid: SidenoteSetup.rootUuid,
        };

        Sidenote.state.notes.push(rootNote);
        Sidenote.createNoteDiv(divId);
        Sidenote.setContents(rootNote);
    },

    createNoteDiv: function(divId) {

        html = "<div class='note' id='" + divId + "'>";
        html += "<div class='editor'></div>";
        html += "</div>";

        $("#note-container").append(html);

        Sidenote.newEditor(divId);

        const div = "#" + divId;
        const toolbarHeight = $(".ql-toolbar").outerHeight(true);
        $(div).css("top", toolbarHeight);
        $(div).css("width", Sidenote.state.noteWidth);
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
      return uuid;
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
}

window.onload = function() {
    Sidenote.init();
}
