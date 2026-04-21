using Autodesk.AutoCAD.Runtime;

[assembly: CommandClass(typeof(Ch19.LineTotaler.Commands))]
[assembly: ExtensionApplication(typeof(Ch19.LineTotaler.Extension))]

namespace Ch19.LineTotaler
{
    public sealed class Extension : IExtensionApplication
    {
        public void Initialize() { }
        public void Terminate() { }
    }
}
