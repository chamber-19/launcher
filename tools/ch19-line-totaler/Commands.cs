using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Windows.Forms;
using Autodesk.AutoCAD.ApplicationServices;
using Autodesk.AutoCAD.DatabaseServices;
using Autodesk.AutoCAD.EditorInput;
using Autodesk.AutoCAD.Runtime;
using Application = Autodesk.AutoCAD.ApplicationServices.Application;

namespace Ch19.LineTotaler
{
    public sealed class Commands
    {
        private static readonly string[] CurveTypes = {
            "LINE", "LWPOLYLINE", "POLYLINE", "ARC", "SPLINE", "ELLIPSE"
        };

        [CommandMethod("CH19TOTAL", CommandFlags.Session)]
        public void TotalSelection()
        {
            var doc = Application.DocumentManager.MdiActiveDocument;
            if (doc == null) return;
            var ed = doc.Editor;

            var filter = new SelectionFilter(new[] {
                new TypedValue((int)DxfCode.Start, string.Join(",", CurveTypes))
            });
            var opts = new PromptSelectionOptions {
                MessageForAdding = "\n[CH19] Select curves to total: "
            };

            var res = ed.GetSelection(opts, filter);
            if (res.Status != PromptStatus.OK) return;

            Report(doc, res.Value.GetObjectIds());
        }

        [CommandMethod("CH19TOTALSIM", CommandFlags.Session)]
        public void TotalSimilar()
        {
            var doc = Application.DocumentManager.MdiActiveDocument;
            if (doc == null) return;
            var ed = doc.Editor;
            var db = doc.Database;

            var pickOpts = new PromptEntityOptions("\n[CH19] Pick one curve: ");
            pickOpts.SetRejectMessage("\nMust be a line/polyline/arc/spline.");
            pickOpts.AddAllowedClass(typeof(Curve), exactMatch: false);

            var pickRes = ed.GetEntity(pickOpts);
            if (pickRes.Status != PromptStatus.OK) return;

            string layer;
            string dxfType;
            using (var tr = db.TransactionManager.StartTransaction())
            {
                var ent = (Entity)tr.GetObject(pickRes.ObjectId, OpenMode.ForRead);
                layer = ent.Layer;
                dxfType = ent.GetType() == typeof(Polyline) ? "LWPOLYLINE" :
                          ent.GetType().Name.ToUpperInvariant();
                tr.Commit();
            }

            var filter = new SelectionFilter(new[] {
                new TypedValue((int)DxfCode.LayerName, layer),
                new TypedValue((int)DxfCode.Start, dxfType)
            });

            var allRes = ed.SelectAll(filter);
            if (allRes.Status != PromptStatus.OK) return;

            ed.WriteMessage($"\n[CH19] Selected {allRes.Value.Count} similar on layer '{layer}'.");
            Report(doc, allRes.Value.GetObjectIds());
        }

        private static void Report(Document doc, ObjectId[] ids)
        {
            var ed = doc.Editor;
            double totalIn = 0;
            int count = 0;
            var byLayer = new Dictionary<string, double>();

            using (var tr = doc.TransactionManager.StartTransaction())
            {
                foreach (var id in ids)
                {
                    if (tr.GetObject(id, OpenMode.ForRead) is Curve curve)
                    {
                        double len;
                        try
                        {
                            len = curve.GetDistanceAtParameter(curve.EndParam)
                                - curve.GetDistanceAtParameter(curve.StartParam);
                        }
                        catch { continue; }

                        if (len <= 0 || double.IsNaN(len)) continue;
                        totalIn += len;
                        count++;
                        byLayer.TryGetValue(curve.Layer, out var sum);
                        byLayer[curve.Layer] = sum + len;
                    }
                }
                tr.Commit();
            }

            if (count == 0)
            {
                ed.WriteMessage("\n[CH19] No curve-like entities in selection.");
                return;
            }

            var ci = CultureInfo.InvariantCulture;
            double ft = totalIn / 12.0;
            double m = totalIn * 0.0254;

            ed.WriteMessage($"\n[CH19] Totaled {count} entit{(count == 1 ? "y" : "ies")}");
            ed.WriteMessage($"\n  Total:  {totalIn.ToString("N2", ci)} in  " +
                            $"({ft.ToString("N2", ci)} ft)  " +
                            $"({m.ToString("N2", ci)} m)");

            if (byLayer.Count > 1)
            {
                ed.WriteMessage("\n  By layer:");
                foreach (var kv in byLayer.OrderByDescending(x => x.Value))
                    ed.WriteMessage($"\n    {kv.Key,-20} {kv.Value.ToString("N2", ci),12} in  " +
                                    $"({(kv.Value / 12).ToString("N2", ci)} ft)");
            }

            try
            {
                Clipboard.SetText(ft.ToString("0.00", ci));
                ed.WriteMessage($"\n  Copied to clipboard: {ft.ToString("0.00", ci)}");
            }
            catch { }
        }
    }
}
