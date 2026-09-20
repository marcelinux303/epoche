import QtQuick
import qs.Commons
import qs.Ui

BorderSurface {
    id: card
    property string category: ""
    property string phrase: ""
    property bool shown: false
    property real availableWidth: Style.space(520)
    readonly property int pad: Style.space(18)

    width: Math.max(1, Math.min(Style.space(520), availableWidth))
    height: borderTop + pad + content.implicitHeight + pad + borderBottom
    color: Color.popups.background
    borderSpec: Border.surfaceSpec("popups", "border", Color.popups.border, Math.max(1, Style.space(2)))
    radius: Style.cornerRadius
    opacity: shown ? 1 : 0
    Behavior on opacity { NumberAnimation { duration: 160 } }

    Column {
        id: content
        x: card.borderLeft + card.pad
        y: card.borderTop + card.pad
        width: Math.max(1, card.width - card.borderLeft - card.borderRight - 2 * card.pad)
        spacing: Style.space(10)
        Text {
            width: parent.width
            text: "EPOCHÉ  ·  " + card.category
            textFormat: Text.PlainText
            wrapMode: Text.WordWrap
            elide: Text.ElideNone
            font.family: Style.font.family
            font.pixelSize: Style.font.caption
            color: Color.popups.text
            opacity: 0.65
        }
        Text {
            width: parent.width
            text: card.phrase
            textFormat: Text.PlainText
            wrapMode: Text.WordWrap
            elide: Text.ElideNone
            font.family: Style.font.family
            font.pixelSize: Style.font.heading
            color: Color.popups.text
        }
    }
}
