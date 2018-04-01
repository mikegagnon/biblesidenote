
var Sidenote = {

    constant: {
        uuidChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        uuidLen: 22,
        marginLeft: 20,
    },

    state: {
        nextNoteNumber: 0,
        notes: [],
        editors: {},
        contents: undefined,
        numVisibleColumns: SidenoteSetup.numVisibleColumns,
        noteWidth: undefined,
    },

    init: function() {
        $("#breadcrumbs").text("foo");
        Sidenote.state.noteWidth = Sidenote.noteWidth();
        Sidenote.initContents();
        Sidenote.initTitle();
        Sidenote.positionMenu();
        Sidenote.initRootNote();
        Sidenote.positionContainer();
    },

    noteWidth: function() {
        return ($("#note-container").width() - Sidenote.constant.marginLeft) / Sidenote.state.numVisibleColumns;
    },

    positionContainer: function() {
        var top = $("#title").outerHeight(true) +
            $("#breadcrumbs").outerHeight(true);

        $("#note-container").css("top", top);
        $("#note-container").css("left", 0);
    },

    initContents: function() {
        Sidenote.state.contents = SidenoteSetup.contents;
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
        Sidenote.getEditor(note).setContents(Sidenote.state.contents[note.uuid].quill);
    },

    getEditor: function(note) {
        return Sidenote.state.editors[note.divId];
    },

    createUuid: function() {
      var uuid = "";
      for (var i = 0; i < Sidenote.constant.uuidLen; i++) {
        uuid += Sidenote.constant.uuidChars.charAt(Math.floor(Math.random() * Sidenote.constant.uuidChars.length));
      }
      return uuid;
    },
}

window.onload = function() {
    Sidenote.init();
}