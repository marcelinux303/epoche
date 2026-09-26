import QtQuick
import qs.Commons

Item {
    id: root

    property string phrase: ""
    property string category: "SYS"
    property real surfaceOpacity: 0
    property real contentOpacity: 0
    property real marksOpacity: 0
    property real revealProgress: 0

    readonly property int designWidth: Style.space(384)
    readonly property int clearanceX: Style.space(5)
    readonly property int clearanceY: Style.space(5)
    readonly property real activeHeight: einklammerungLayout.implicitHeight
    readonly property color fieldColor: Qt.rgba(Color.popups.background.r, Color.popups.background.g, Color.popups.background.b, Color.popups.background.a * 0.94)
    readonly property color markColor: Util.alpha(Color.accent, 0.56)

    width: designWidth + 2 * clearanceX
    height: activeHeight + 2 * clearanceY

    Rectangle {
        id: field
        x: root.clearanceX
        y: root.clearanceY
        width: root.designWidth
        height: root.activeHeight
        color: root.fieldColor
        opacity: root.surfaceOpacity
    }

    Item {
        id: einklammerungLayout
        x: root.clearanceX
        y: root.clearanceY
        width: root.designWidth
        implicitHeight: Math.max(Style.space(118), einklammerungPhrase.y + einklammerungPhrase.implicitHeight + Style.space(22))

        Item {
            id: topLeftCorner
            x: Style.space(8) - Style.space(2) * (1 - root.revealProgress)
            y: Style.space(8) - Style.space(2) * (1 - root.revealProgress)
            width: Style.space(13)
            height: Style.space(13)
            opacity: root.marksOpacity

            Rectangle {
                width: parent.width
                height: Math.max(1, Style.spacing.hairline)
                color: root.markColor
            }
            Rectangle {
                width: Math.max(1, Style.spacing.hairline)
                height: parent.height
                color: root.markColor
            }
        }

        Item {
            id: bottomRightCorner
            x: einklammerungLayout.width - Style.space(8) - width + Style.space(2) * (1 - root.revealProgress)
            y: einklammerungLayout.implicitHeight - Style.space(8) - height + Style.space(2) * (1 - root.revealProgress)
            width: Style.space(13)
            height: Style.space(13)
            opacity: root.marksOpacity

            Rectangle {
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                width: parent.width
                height: Math.max(1, Style.spacing.hairline)
                color: root.markColor
            }
            Rectangle {
                anchors.right: parent.right
                anchors.bottom: parent.bottom
                width: Math.max(1, Style.spacing.hairline)
                height: parent.height
                color: root.markColor
            }
        }

        Item {
            id: einklammerungContent
            x: 0
            y: -Style.space(4) * (1 - root.revealProgress)
            width: parent.width
            height: einklammerungLayout.implicitHeight
            opacity: root.contentOpacity

            Row {
                id: einklammerungMeta
                y: Style.space(22)
                anchors.horizontalCenter: parent.horizontalCenter
                spacing: Style.space(6)

                Text {
                    text: "Epoché"
                    textFormat: Text.PlainText
                    font.family: Style.font.family
                    font.pixelSize: Style.font.bodySmall
                    color: Color.popups.text
                    opacity: 0.72
                }
                Text {
                    text: "· " + root.category
                    textFormat: Text.PlainText
                    font.family: Style.font.family
                    font.pixelSize: Style.font.caption
                    font.weight: Font.DemiBold
                    color: Color.popups.text
                    opacity: 0.56
                }
            }

            Text {
                id: einklammerungPhrase
                x: Style.space(28)
                y: einklammerungMeta.y + einklammerungMeta.implicitHeight + Style.space(14)
                width: parent.width - Style.space(56)
                text: root.phrase
                textFormat: Text.PlainText
                wrapMode: Text.Wrap
                elide: Text.ElideNone
                horizontalAlignment: Text.AlignLeft
                font.family: Style.font.family
                font.pixelSize: Style.font.heading
                font.weight: Font.Normal
                lineHeightMode: Text.ProportionalHeight
                lineHeight: 1.30
                color: Color.popups.text
            }
        }
    }
}
