
var Sidenote = {

    constant: {
        uuidChars: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
        uuidLen: 10,
        marginLeft: 20,
    },

    state: {
        nextNoteNumber: 0,
        notes: [],
        editors: {},
        contents: undefined,
    },

    init: function() {
        Sidenote.initContents();
        Sidenote.initTitle();
        Sidenote.initRootNote();
    },

    initContents: function() {
        Sidenote.state.contents = SidenoteSetup.contents;
    },

    initTitle: function() {
        $("#title h1").text(SidenoteSetup.title);
        $("#title").css("margin-left", Sidenote.constant.marginLeft);
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